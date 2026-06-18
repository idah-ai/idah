// ---------------------------------------------------------------------------
// stats.ts — Register video-specific stats with the V2 driver
//
// Called once on init(driver). Contributes video info (duration / fps / frame
// count) read live from driver.media.meta, so the core entry-stats modal stays
// free of any video-specific knowledge.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2, IStatEntry } from "$idah/v2/types";

export function registerStats(driver: IIdahDriverV2): void {
  driver.stats.register({
    collect(): IStatEntry[] {
      const meta = driver.media.meta ?? {};
      if (Object.keys(meta).length === 0) return [];

      const duration = Number(meta.duration ?? 0);
      const fps = Number(meta.fps ?? 0);

      return [
        { key: "video.duration_seconds", value: String(duration), section: "video", label: "Duration in Seconds" },
        { key: "video.fps", value: String(fps), section: "video", label: "Frame(s) per Second" },
        {
          key: "video.frame_count",
          value: String(Math.round(duration * fps)),
          section: "video",
          label: "Total Number of Frame(s)",
        },
      ];
    },
  });
}
