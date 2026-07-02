// ---------------------------------------------------------------------------
// browser.ts — Cross-browser / cross-platform utilities
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the browser is running on an Apple (macOS / iOS) system.
 * This is used to decide whether Cmd (Meta) or Ctrl should be the primary
 * modifier key for keyboard shortcuts and gestures.
 */
export function isMac(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform ?? "")
  );
}

/**
 * Returns the correct modifier key for the current platform.
 * On Mac this is `metaKey`, on other platforms it's `ctrlKey`.
 */
export function modKey(e: KeyboardEvent | MouseEvent | WheelEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}

/**
 * Heuristically detects whether a wheel event came from a physical mouse wheel
 * rather than a touchpad. Line/page-mode deltas are only ever produced by a real
 * wheel; in pixel mode a mouse wheel emits a coarse, integer step with no
 * horizontal component, whereas a touchpad emits small and/or fractional deltas.
 *
 * Used to pick the zoom gesture: a mouse wheel zooms directly (modifier pans),
 * while a touchpad keeps pinch-to-zoom (modifier) and two-finger pan.
 */
export function isMouseWheelEvent(e: WheelEvent): boolean {
  if (e.deltaMode !== 0 /* DOM_DELTA_PIXEL */) return true;
  return e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50;
}

/**
 * Convert a shortcut string from the canonical `Control+...` form to
 * the platform-appropriate form.
 *
 * On non-Mac:
 *   `"Control+Z"` → `"Control+Z"`
 * On Mac:
 *   `"Control+Z"` → `"Meta+Z"`
 */
export function platformShortcut(shortcut: string | null): string | null {
  if (!shortcut || !isMac()) return shortcut;
  return shortcut.replace(/\bControl\b/g, "Meta");
}

/**
 * Return the display label for the Control/Ctrl modifier key.
 * On Mac: `"⌘"` (Cmd symbol)
 * On other platforms: `"Ctrl"`
 */
export function modKeyLabel(): string {
  return isMac() ? "\u2318" : "Ctrl";
}
