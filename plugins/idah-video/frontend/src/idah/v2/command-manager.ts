// ---------------------------------------------------------------------------
// V2 Command Manager — register, call, undo / redo
// ---------------------------------------------------------------------------
import type {
  ICommandDescriptor,
  ICommandAction,
  ICommandStackEntry,
  IShortcut,
} from "$idah/v2/types";
import { buildKeyCombination } from "$idah/utils/shortcut-utils";

export class CommandManagerV2 {
  /** Registered commands keyed by name. */
  private registry = new Map<string, ICommandDescriptor & { callback: (opts?: Record<string, unknown>) => ICommandAction }>();

  /** Undo stack (most recent at end). */
  private undoStack: ICommandStackEntry[] = [];
  /** Redo stack (most recent at end). */
  private redoStack: ICommandStackEntry[] = [];

  /** Maximum undo depth. */
  private maxStack = 200;
  /** Time window (ms) for auto-combine. */
  private combineWindow = 5000;

  /** Current driver mode, used by getActiveCommands(). Updated externally. */
  currentMode: string = "default";

  // ── Registration ──────────────────────────────────────────────────────

  register(
    name: string,
    modes: string[],
    shortcut: IShortcut | null,
    shortDescription: string | null,
    longDescription: string | null,
    callback: (opts?: Record<string, unknown>) => ICommandAction,
    group?: string,
  ): void {
    if (this.registry.has(name)) {
      throw new Error(`Command already registered: "${name}"`);
    }
    this.registry.set(name, {
      name,
      group,
      modes,
      shortcut,
      shortDescription,
      longDescription,
      callback,
    });
  }

  // ── Execution ──────────────────────────────────────────────────────────

  call(name: string, ...opts: Record<string, unknown>[]): void {
    const entry = this.registry.get(name);
    if (!entry) {
      console.error(`[command] unknown command: "${name}"`);
      return;
    }

    const props = opts.length > 0 ? opts[0] : undefined;
    const action = entry.callback(props);

    // Clear redo on new action
    this.redoStack = [];

    if (action.undo) {
      // Attempt combine with the previous action in the stack
      const last = this.undoStack[this.undoStack.length - 1];
      if (last) {
        const diff = Date.now() - last.timestamp;
        if (diff < this.combineWindow && action.isCombinable(last.action)) {
          const combined = action.combine(last.action);
          // Replace the last entry with the combined action
          this.undoStack[this.undoStack.length - 1] = {
            action: combined,
            timestamp: Date.now(),
          };
          combined.do();
          return;
        }
      }

      // Normal push
      this.undoStack.push({ action, timestamp: Date.now() });
      if (this.undoStack.length > this.maxStack) {
        this.undoStack.shift();
      }
    }

    action.do();
  }

  // ── Undo / Redo ────────────────────────────────────────────────────────

  undo(count: number = 1): boolean {
    let did = false;
    for (let i = 0; i < count; i++) {
      const entry = this.undoStack.pop();
      if (!entry) break;
      entry.action.undo?.();
      this.redoStack.push(entry);
      did = true;
    }
    return did;
  }

  redo(count: number = 1): boolean {
    let did = false;
    for (let i = 0; i < count; i++) {
      const entry = this.redoStack.pop();
      if (!entry) break;
      entry.action.do();
      this.undoStack.push(entry);
      did = true;
    }
    return did;
  }

  // ── Listing ────────────────────────────────────────────────────────────

  history(n: number = 50): { undo: ICommandStackEntry[]; redo: ICommandStackEntry[] } {
    return {
      undo: this.undoStack.slice(-n),
      redo: this.redoStack.slice(-n),
    };
  }

  /** Return commands that are available in the currentMode, with group info. */
  getActiveCommands(): ICommandDescriptor[] {
    const result: ICommandDescriptor[] = [];
    for (const entry of this.registry.values()) {
      if (entry.modes.includes(this.currentMode)) {
        result.push({
          name: entry.name,
          group: entry.group,
          modes: entry.modes,
          shortcut: entry.shortcut,
          shortDescription: entry.shortDescription,
          longDescription: entry.longDescription,
        });
      }
    }
    return result;
  }

  /**
   * Return ALL registered commands (regardless of mode or shortcut),
   * grouped by their `group` field for display in the command palette.
   * Commands without a group are placed under "General".
   */
  getAllCommands(): Map<string, ICommandDescriptor[]> {
    const groups = new Map<string, ICommandDescriptor[]>();
    for (const entry of this.registry.values()) {
      const desc: ICommandDescriptor = {
        name: entry.name,
        group: entry.group,
        modes: entry.modes,
        shortcut: entry.shortcut,
        shortDescription: entry.shortDescription,
        longDescription: entry.longDescription,
      };
      const groupName = entry.group || "General";
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(desc);
    }
    return groups;
  }

  /** Get a registered callback by name (for tests). */
  getCallback(name: string): ((opts?: Record<string, unknown>) => ICommandAction) | undefined {
    return this.registry.get(name)?.callback;
  }

  /**
   * Return the human-readable shortcut label for a command name, or undefined
   * if the command has no shortcut or doesn't exist.
   */
  getShortcut(name: string): string | undefined {
    const entry = this.registry.get(name);
    if (!entry || !entry.shortcut) return undefined;
    return entry.shortcut;
  }

  /** Return a single command descriptor by name. */
  getCommand(name: string): ICommandDescriptor | undefined {
    const entry = this.registry.get(name);
    if (!entry) return undefined;
    return {
      name: entry.name,
      group: entry.group,
      modes: entry.modes,
      shortcut: entry.shortcut,
      shortDescription: entry.shortDescription,
      longDescription: entry.longDescription,
    };
  }

  // ── Keyboard resolution ────────────────────────────────────────────────

  /**
   * Resolve a KeyboardEvent against the registered shortcuts for a given mode.
   * If a matching command is found, it is executed via `call()`.
   * Returns `true` if a shortcut was matched (event should be consumed),
   * `false` otherwise.
   */
  resolveKeyEvent(event: KeyboardEvent, mode: string): boolean {
    const keyMap = this.getKeyMapForMode(mode);
    const combo = buildKeyCombination(event);
    const commandName = keyMap[combo];
    if (commandName) {
      this.call(commandName);
      return true;
    }
    return false;
  }

  /**
   * Return the flat key-combination → command name map for a given mode.
   * This is what the keyboard handler uses for O(1) event dispatch.
   */
  getKeyMapForMode(mode: string): Record<string, string> {
    const map: Record<string, string> = {};
    for (const entry of this.registry.values()) {
      if (entry.shortcut && entry.modes.includes(mode)) {
        map[entry.shortcut] = entry.name;
      }
    }
    return map;
  }

  /**
   * Return a consolidated reference list of all registered shortcuts
   * across all modes, for use in the command palette.
   * Same shape as `IActivityContext.shortcutReferences`.
   */
  getShortcutReferences(): Record<
    string,
    { label: string; description: string; keyCombinations: string[] }
  > {
    const refs: Record<string, { label: string; description: string; keyCombinations: string[] }> = {};
    for (const entry of this.registry.values()) {
      if (!entry.shortcut) continue;
      if (!refs[entry.name]) {
        refs[entry.name] = {
          label: entry.shortDescription ?? entry.name,
          description: entry.longDescription ?? "",
          keyCombinations: [entry.shortcut],
        };
      } else if (!refs[entry.name].keyCombinations.includes(entry.shortcut)) {
        refs[entry.name].keyCombinations.push(entry.shortcut);
      }
    }
    return refs;
  }
}
