import type { CommandManagerV2 } from "../command-manager";
import type { ICommandAction, ICommandDescriptor, ICommandDriverV2, ICommandStackEntry, IShortcut } from "../types";

// ---------------------------------------------------------------------------
// Adapter: command driver → ICommandDriverV2
// ---------------------------------------------------------------------------
export class CommandDriverAdapter implements ICommandDriverV2 {
  #paletteOpen = false;
  #paletteListeners: Set<(open: boolean) => void> = new Set();

  constructor(private mgr: CommandManagerV2) {}

  isPaletteOpen(): boolean {
    return this.#paletteOpen;
  }

  openPalette(open?: boolean): void {
    this.#paletteOpen = open !== undefined ? open : !this.#paletteOpen;
    for (const cb of this.#paletteListeners) cb(this.#paletteOpen);
  }

  onPaletteChange(cb: (open: boolean) => void): () => void {
    this.#paletteListeners.add(cb);
    return () => this.#paletteListeners.delete(cb);
  }

  register(opts: {
    name: string;
    modes: string[];
    shortcut: IShortcut | null;
    shortDescription: string | null;
    longDescription: string | null;
    callback: (opts?: Record<string, unknown>) => ICommandAction;
    group?: string;
    activeWhen?: () => boolean;
  }): void {
    this.mgr.register(opts);
  }

  call(name: string, ...opts: Record<string, unknown>[]): void {
    this.mgr.call(name, ...opts);
  }

  undo(count?: number): boolean {
    return this.mgr.undo(count);
  }

  redo(count?: number): boolean {
    return this.mgr.redo(count);
  }

  canUndo(): boolean {
    return this.mgr.canUndo();
  }

  canRedo(): boolean {
    return this.mgr.canRedo();
  }

  history(n?: number): { undo: ICommandStackEntry[]; redo: ICommandStackEntry[] } {
    return this.mgr.history(n);
  }

  getActiveCommands(): ICommandDescriptor[] {
    return this.mgr.getActiveCommands();
  }

  getCommand(name: string): ICommandDescriptor | undefined {
    return this.mgr.getCommand(name);
  }

  getShortcut(name: string): string | undefined {
    return this.mgr.getShortcut(name);
  }

  getAllCommands(currentMode?: string): Map<string, ICommandDescriptor[]> {
    return this.mgr.getAllCommands(currentMode);
  }

  resolveKeyEvent(event: KeyboardEvent, mode: string): boolean {
    return this.mgr.resolveKeyEvent(event, mode);
  }

  getKeyMapForMode(mode: string): Record<string, string> {
    return this.mgr.getKeyMapForMode(mode);
  }

  getShortcutReferences(): Record<string, { label: string; description: string; keyCombinations: string[] }> {
    return this.mgr.getShortcutReferences();
  }
}
