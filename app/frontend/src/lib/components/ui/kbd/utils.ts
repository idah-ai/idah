// ---------------------------------------------------------------------------
// Kbd utils — Maps key-combination strings to human-readable labels
// ---------------------------------------------------------------------------

import { isMac, modKeyLabel } from "$lib/plugin/v2/utils/browser";

const MODIFIER_SYMBOLS: Record<string, string> = {
  Control: "⌃",
  Alt: "⌥",
  Shift: "⇧",
  Meta: "⌘",
};

const _isMac = isMac();

/**
 * Convert a canonical key-combination string to a human-readable label.
 *
 * Examples:
 *   - `"Control+Z"` → `"⌃Z"` (Mac) / `"Ctrl+Z"` (non-Mac)
 *   - `"Delete"` → `"Del"`
 *   - `"Control+Shift+S"` → `"⌃⇧S"` (Mac) / `"Ctrl+Shift+S"` (non-Mac)
 */
export function getShortcutLabel(shortcut: string): string {
  const parts = shortcut.split("+");
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);

  const modLabel = modifiers
    .map((m) => (_isMac ? (MODIFIER_SYMBOLS[m] ?? m) : m === "Control" ? modKeyLabel() : m))
    .join(_isMac ? "" : "+");

  const keyLabel = key === "Space" ? "␣" : key === "ArrowRight" ? "→" : key === "ArrowLeft" ? "←" : key;

  return _isMac ? `${modLabel}${keyLabel}` : modLabel ? `${modLabel}+${keyLabel}` : keyLabel;
}

/**
 * Convert an array of canonical key-combination strings to human-readable labels.
 * This is used by the command palette to display shortcut badges.
 *
 * @deprecated Use `getShortcutLabel` directly; this wrapper only exists for
 * backwards compatibility with the V1 activity context.
 */
export function getShortcuts(shortcuts: string[]): string[] {
  return shortcuts.map(getShortcutLabel);
}

/**
 * Get the primary (first) shortcut label from a keyCombinations array.
 * Returns `undefined` if the array is empty or undefined.
 *
 * This is used by the V1 activity context's ToolTooltip components.
 *
 * @deprecated Use `getShortcutLabel` directly.
 */
export function getShortcut(keyCombinations: string[] | undefined): string | undefined {
  if (!keyCombinations || keyCombinations.length === 0) return undefined;
  return getShortcutLabel(keyCombinations[0]);
}
