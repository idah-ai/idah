// ---------------------------------------------------------------------------
// Time tracking stats — contributed from the driver's `timeTracking` (combined
// per-step totals) and `workTimes` (per-author rolled-up rows). Renders as a
// "Time" section in the entry-stats modal with a row per step and one indented
// row per author underneath.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2, IStatEntry, IStatProvider } from "../../types";
import { formatDuration } from "@/utils/duration";

export class TimeStatsProvider implements IStatProvider {
  constructor(private driver: IIdahDriverV2) {}

  collect(): IStatEntry[] {
    const stats: IStatEntry[] = [];
    const timeTracking = this.driver.timeTracking;
    const workTimes = this.driver.workTimes ?? [];

    if (timeTracking && Object.keys(timeTracking).length > 0) {
      // Per-step totals (combined across authors)
      for (const [step, seconds] of Object.entries(timeTracking)) {
        stats.push({
          key: `time.${step}.total`,
          value: formatDuration(seconds),
          section: "time",
          sectionHeader: "Time",
          unitHeader: "Duration",
          label: step.charAt(0).toUpperCase() + step.slice(1),
        });
      }
    }

    // Per-author rows, one per (step, author) stint
    for (const wt of workTimes) {
      const showEmail =
        wt.email && wt.email !== "null" ? wt.email : `Account ${wt.accountId}`;
      stats.push({
        key: `time.${wt.wfStep}.${wt.accountId}`,
        value: formatDuration(wt.seconds),
        section: "time",
        sectionHeader: "Time",
        unitHeader: "Duration",
        label: showEmail,
      });
    }

    return stats;
  }
}