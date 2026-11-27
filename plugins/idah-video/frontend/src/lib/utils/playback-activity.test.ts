// ---------------------------------------------------------------------------
// playback-activity.test.ts — Unit tests for startPlaybackActivity
// ---------------------------------------------------------------------------
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYBACK_ACTIVITY_EVERY_MS, startPlaybackActivity } from "./playback-activity";

describe("startPlaybackActivity", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function start(state: { playing: boolean; visible: boolean }) {
    const notify = vi.fn();
    const stop = startPlaybackActivity({
      isPlaying: () => state.playing,
      isVisible: () => state.visible,
      notify,
    });
    return { notify, stop };
  }

  it("records activity while the video plays in a visible tab", () => {
    const { notify } = start({ playing: true, visible: true });

    vi.advanceTimersByTime(PLAYBACK_ACTIVITY_EVERY_MS * 3);

    expect(notify).toHaveBeenCalledTimes(3);
  });

  it("pings often enough that every 2-minute time slot gets one", () => {
    expect(PLAYBACK_ACTIVITY_EVERY_MS).toBeLessThan(120_000);
  });

  it("records nothing while the video is paused", () => {
    const { notify } = start({ playing: false, visible: true });

    vi.advanceTimersByTime(PLAYBACK_ACTIVITY_EVERY_MS * 3);

    expect(notify).not.toHaveBeenCalled();
  });

  it("records nothing while the user is on another tab, even if the video plays", () => {
    const { notify } = start({ playing: true, visible: false });

    vi.advanceTimersByTime(PLAYBACK_ACTIVITY_EVERY_MS * 3);

    expect(notify).not.toHaveBeenCalled();
  });

  it("follows play, pause and tab changes as they happen", () => {
    const state = { playing: false, visible: true };
    const { notify } = start(state);

    vi.advanceTimersByTime(PLAYBACK_ACTIVITY_EVERY_MS);
    expect(notify).toHaveBeenCalledTimes(0);

    state.playing = true;
    vi.advanceTimersByTime(PLAYBACK_ACTIVITY_EVERY_MS);
    expect(notify).toHaveBeenCalledTimes(1);

    state.visible = false;
    vi.advanceTimersByTime(PLAYBACK_ACTIVITY_EVERY_MS);
    expect(notify).toHaveBeenCalledTimes(1);

    state.visible = true;
    vi.advanceTimersByTime(PLAYBACK_ACTIVITY_EVERY_MS);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("stops once cleaned up", () => {
    const { notify, stop } = start({ playing: true, visible: true });

    stop();
    vi.advanceTimersByTime(PLAYBACK_ACTIVITY_EVERY_MS * 3);

    expect(notify).not.toHaveBeenCalled();
  });
});
