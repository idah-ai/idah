// ---------------------------------------------------------------------------
// Shortcut utility functions
// ---------------------------------------------------------------------------

/**
 * Build the canonical key-combination string from a KeyboardEvent.
 *
 * Format: `"ModifierA+ModifierB+Key"` where modifiers are sorted alphabetically.
 * When there are no modifiers, it's just the key name.
 *
 * Examples:
 *   - `buildKeyCombination({ ctrlKey: true, key: "z", code: "KeyZ" })` → `"Control+Z"`
 *   - `buildKeyCombination({ key: "Delete", code: "Delete" })` → `"Delete"`
 */
export function buildKeyCombination(e: KeyboardEvent): string {
  const modifiers = [
    e.altKey && "Alt",
    e.ctrlKey && "Control",
    e.metaKey && "Meta",
    e.shiftKey && "Shift",
  ]
    .filter(Boolean)
    .sort() as string[];

  // If the pressed key is itself a modifier, there is no "key" component
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
    return modifiers.join("+");
  }

  // For letter keys use the uppercase letter; for everything else use the code
  const key = e.code.startsWith("Key") ? e.key.toLocaleUpperCase() : e.code;

  return [...modifiers, key].join("+");
}

/**
 * Parse a canonical key-combination string into its parts.
 *
 * Example: `parseShortcut("Control+Shift+Z")` → `{ key: "Z", modifiers: ["Control", "Shift"] }`
 */
export function parseShortcut(shortcut: string): { key: string; modifiers: string[] } {
  const parts = shortcut.split("+");
  return {
    key: parts[parts.length - 1],
    modifiers: parts.slice(0, -1),
  };
}
