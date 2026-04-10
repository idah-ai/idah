/**
 * Utility functions for Kbd component
 */

const SYMBOL_MAP: Record<string, string> = {
  // Common / Windows
  Control: "Ctrl",
  Meta: "Win",
  Shift: "⇧",
  Alt: "Alt",
  Backspace: "⌫",
  Delete: "Del",
  Escape: "Esc",
  Enter: "↵",
  Tab: "⇥",
  Space: "␣",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  PageUp: "⇞",
  PageDown: "⇟",
  Home: "Home",
  End: "End",
  CapsLock: "⇪",

  // TODO: implement OS detection ?
  // Mac
  // Control: "⌃",
  // Meta: "⌘",
  // Shift: "⇧",
  // Alt: "⌥",
  // Backspace: "⌫",
  // Delete: "⌦",
  // Escape: "⎋",
  // Enter: "↵",
  // Tab: "⇥",
  // Space: "Space",
  // ArrowUp: "↑",
  // ArrowDown: "↓",
  // ArrowLeft: "←",
  // ArrowRight: "→",
  // PageUp: "⇞",
  // PageDown: "⇟",
  // Home: "↖",
  // End: "↘",
  // CapsLock: "⇪",
};

/**
 * Get the symbol for a key name
 * @param key The key name (e.g., "Control", "Meta", "A")
 * @returns The symbol (e.g., "Ctrl", "⌘", "A")
 */
export function getKeySymbol(key: string): string {
  // TODO: Add different mapping for different OS later
  return SYMBOL_MAP[key] || key;
}

// get the symbol of each key
export function getKeySymbols(keys: string[]): string[] {
  return keys.map(getKeySymbol);
}

// humanize the key combination (e.g., ["Meta", "A"] -> "⌘+A")
export function getHunamizedKeyCombination(keys: string[]): string {
  return keys.map(getKeySymbol).join("+");
}

/**
 * Format a keyCombinations array into a human-readable shortcut string with symbols.
 * Accepts the `keyCombinations` array from the shortcut reference list and returns
 * the primary (first) combination humanized (e.g., ["Control+Z", "Meta+Z"] → "Ctrl+Z").
 * @param keyCombinations Array of combination strings or undefined.
 * @returns The formatted shortcut string or undefined.
 */
export function getShortcut(keyCombinations: string[] | undefined): string | undefined {
  if (!keyCombinations || keyCombinations.length === 0) return undefined;

  // Use only the primary (first) combination, split into individual keys, then humanize
  return getHunamizedKeyCombination(keyCombinations[0].split("+"));
}

/**
 * Format a keyCombinations array into a human-readable shortcut string with symbols.
 * Accepts the `keyCombinations` array from the shortcut reference list and returns
 * the combinations humanized (e.g., ["Control+Z", "Meta+Z"] → ["Ctrl+Z", "⌘+Z"]).
 * @param keyCombinations Array of combination strings or undefined.
 * @returns The formatted shortcut string or undefined.
 */
export function getShortcuts(keyCombinations: string[] | undefined): string[] | undefined {
  if (!keyCombinations || keyCombinations.length === 0) return undefined;

  // Use only the primary (first) combination, split into individual keys, then humanize
  return keyCombinations.map((k) => getHunamizedKeyCombination(k.split("+")));
}