import { describe, it, expect, vi } from "vitest";
import { ACTIVITY_EVENTS, trackActivity } from "./activity-tracker";

describe("trackActivity", () => {
  it.each(ACTIVITY_EVENTS)("records activity on %s", (type) => {
    const target = new EventTarget();
    const notify = vi.fn();
    trackActivity(target, notify);

    target.dispatchEvent(new Event(type));

    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("covers clicks, mouse-wheel zoom and key presses", () => {
    expect([...ACTIVITY_EVENTS].sort()).toEqual(["keydown", "pointerdown", "wheel"]);
  });

  it("ignores input that is not work, such as hovering", () => {
    const target = new EventTarget();
    const notify = vi.fn();
    trackActivity(target, notify);

    target.dispatchEvent(new Event("pointermove"));
    target.dispatchEvent(new Event("pointerover"));

    expect(notify).not.toHaveBeenCalled();
  });

  it("listens in the capture phase, so a plugin stopping the event cannot hide it", () => {
    const target = new EventTarget();
    const add = vi.spyOn(target, "addEventListener");
    trackActivity(target, vi.fn());

    for (const call of add.mock.calls) {
      expect(call[2]).toMatchObject({ capture: true, passive: true });
    }
    expect(add).toHaveBeenCalledTimes(ACTIVITY_EVENTS.length);
  });

  it("stops recording once cleaned up", () => {
    const target = new EventTarget();
    const notify = vi.fn();
    const stop = trackActivity(target, notify);

    stop();
    for (const type of ACTIVITY_EVENTS) target.dispatchEvent(new Event(type));

    expect(notify).not.toHaveBeenCalled();
  });
});
