// ---------------------------------------------------------------------------
// playback-activity.ts — Time tracking while a video plays
// ---------------------------------------------------------------------------
// Watching playback is work, but it involves no click, scroll or key press, so
// the editor's input tracker never sees it. This pings while the video plays.
// It skips while the tab is hidden, so a video left playing in a background tab
// records no time.

/**
 * How often to ping while playing. Shorter than the 2-minute time slot, so every
 * slot of playback gets a ping; the driver sends at most one request per slot.
 */
export const PLAYBACK_ACTIVITY_EVERY_MS = 30_000;

export interface PlaybackActivityOptions {
  isPlaying: () => boolean;
  isVisible: () => boolean;
  notify: () => void;
}

/** Starts the playback pings and returns the cleanup. */
export function startPlaybackActivity({ isPlaying, isVisible, notify }: PlaybackActivityOptions): () => void {
  const timer = setInterval(() => {
    if (isPlaying() && isVisible()) notify();
  }, PLAYBACK_ACTIVITY_EVERY_MS);
  return () => clearInterval(timer);
}
