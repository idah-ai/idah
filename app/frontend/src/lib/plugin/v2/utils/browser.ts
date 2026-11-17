// ---------------------------------------------------------------------------
// browser.ts — Cross-browser / cross-platform utilities (V2 duplicate)
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the browser is running on an Apple (macOS / iOS) system.
 * This is used to decide whether Cmd (Meta) or Ctrl should be the primary
 * modifier key for keyboard shortcuts and gestures.
 */
export function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform ?? "");
}

/**
 * Returns the correct modifier key for the current platform.
 * On Mac this is `metaKey`, on other platforms it's `ctrlKey`.
 */
export function modKey(e: KeyboardEvent | MouseEvent | WheelEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}

/**
 * Return the display label for the Control/Ctrl modifier key.
 * On Mac: `"⌘"` (Cmd symbol)
 * On other platforms: `"Ctrl"`
 */
export function modKeyLabel(): string {
  return isMac() ? "\u2318" : "Ctrl";
}
