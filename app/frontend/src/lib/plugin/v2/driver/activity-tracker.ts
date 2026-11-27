/**
 * User input in the editor that counts as work for time tracking.
 *
 * Covers mouse work (wheel zoom, panning, play, toolbar buttons) as well as the
 * keyboard, so a review done with the mouse alone still records time. Hovering
 * is not counted: it happens when nobody is working too.
 */
export const ACTIVITY_EVENTS = ["pointerdown", "wheel", "keydown"] as const;

/**
 * Calls `notify` on every activity event inside `target`, and returns the
 * cleanup. `notify` should be throttled (the driver's `notifyActivity` sends at
 * most one request per 2-minute slot). Listens in the capture phase, so a
 * plugin that stops an event's propagation still has it counted.
 */
export function trackActivity(target: EventTarget, notify: () => void): () => void {
  const listener = (): void => notify();
  for (const type of ACTIVITY_EVENTS) {
    target.addEventListener(type, listener, { capture: true, passive: true });
  }
  return () => {
    for (const type of ACTIVITY_EVENTS) {
      target.removeEventListener(type, listener, { capture: true });
    }
  };
}
