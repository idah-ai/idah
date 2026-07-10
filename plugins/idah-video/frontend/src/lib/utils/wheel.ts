/**
 * Converts a WheelEvent delta to pixels.
 * Linux/Windows mouse wheels typically use DOM_DELTA_LINE (mode 1) with small
 * integer values (e.g. 3), which would be imperceptible without this conversion.
 */
export function normalizeWheelDelta(
  delta: number,
  deltaMode: number,
  viewportHeight: number,
): number {
  if (deltaMode === 1 /* DOM_DELTA_LINE */) return delta * 40;
  if (deltaMode === 2 /* DOM_DELTA_PAGE */) return delta * viewportHeight;
  return delta; // DOM_DELTA_PIXEL — already in pixels
}

/**
 * Computes the effective [dx, dy] pixel deltas for a wheel pan event.
 *
 * 1. Normalises raw deltas to pixels (handling LINE/PAGE modes).
 * 2. Applies the Shift+key horizontal pan fix:
 *    macOS natively swaps deltaX/deltaY when Shift is held (vertical wheel →
 *    horizontal pan). Windows/Linux do NOT — we handle it here so
 *    Shift+wheel consistently provides horizontal panning across platforms.
 */
export function computeWheelPan(
  deltaX: number,
  deltaY: number,
  deltaMode: number,
  shiftKey: boolean,
  viewportHeight: number,
): [number, number] {
  let dx = normalizeWheelDelta(deltaX, deltaMode, viewportHeight);
  let dy = normalizeWheelDelta(deltaY, deltaMode, viewportHeight);

  if (shiftKey && dx === 0 && dy !== 0) {
    dx = dy;
    dy = 0;
  }

  return [dx, dy];
}