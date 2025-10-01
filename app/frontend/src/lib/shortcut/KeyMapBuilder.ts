/**
 * KeyMapBuilder - A DSL for creating keyboard shortcuts
 *
 * Example usage:
 * ```
 * const keyMap = KeyMapBuilder((b) => {
 *   b.on([b.Shift, b.Ctrl], "A", action, "Ctrl+Shift+A", "Performs action A with Ctrl+Shift");
 *   b.on(null, "B", action, "B", "Performs action B");
 * });
 * ```
 */

import type { KeyMap } from "./ShortcutManager";

type ModifierKey = string;
type ActionKey = string;
type KeyCombination = string;
type Action = () => void;

class Builder {
  // Modifier key constants
  readonly Shift: ModifierKey = "Shift";
  readonly Ctrl: ModifierKey = "Control";
  readonly Alt: ModifierKey = "Alt";
  readonly Meta: ModifierKey = "Meta"; // Command key on Mac, Windows key on Windows

  private keyMap: KeyMap = {};

  /**
   * Register a keyboard shortcut
   * @param modifiers Array of modifier keys or null if no modifiers
   * @param key The main key of the shortcut
   * @param action The action to execute when the shortcut is triggered
   * @param name Name for the shortcut
   * @param description Description for the shortcut
   */
  on(modifiers: ModifierKey[] | null, key: ActionKey, action: Action, name: string, description: string): Builder {
    const keyCombination = this.buildKeyCombination(modifiers, key);

    this.keyMap[keyCombination] = {
      name,
      description,
      action,
    };

    return this;
  }

  /**
   * Build a string representation of the key combination
   * @param modifiers Array of modifier keys or null if no modifiers
   * @param key The main key of the shortcut
   * @returns A string representation of the key combination
   */
  private buildKeyCombination(modifiers: ModifierKey[] | null, key: ActionKey): KeyCombination {
    if (!modifiers || modifiers.length === 0) {
      return key;
    }

    // Sort modifiers to ensure consistent key combinations
    const sortedModifiers = [...modifiers].sort();
    return `${sortedModifiers.join("+")}+${key}`;
  }

  /**
   * Get the built key map
   * @returns The key map
   */
  getKeyMap(): KeyMap {
    return this.keyMap;
  }
}

/**
 * Create a key map using the builder DSL
 * @param builderFn Function that uses the builder to define shortcuts
 * @returns The built key map
 */
export function KeyMapBuilder(builderFn: (builder: Builder) => void): KeyMap {
  const builder = new Builder();
  builderFn(builder);
  return builder.getKeyMap();
}
