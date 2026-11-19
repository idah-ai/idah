// ---------------------------------------------------------------------------
// Time tracking stats — contributed from the driver's `timeTracking` (combined
// per-step totals) and `workTimes` (per-author rolled-up rows). Renders as a
// "Time" section in the entry-stats modal with a row per step and one indented
// row per author underneath.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2, IStatEntry, IStatProvider } from "../../types";
import { formatSeconds } from "@/utils/duration";

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
          value: formatSeconds(seconds),
          section: "time",
          sectionHeader: "Time",
          unitHeader: "Duration",
          label: step.charAt(0).toUpperCase() + step.slice(1),
        });
      }
    }

    // Per-author rows, grouped by (wfStep, accountId) and summed — after a
    // reject cycle the same person can have multiple rows on the same step.
    const grouped = new Map<
      string,
      { wfStep: string; accountId: number; email: string | null; seconds: number; unsubmitted: boolean }
    >();

    for (const wt of workTimes) {
      const key = `${wt.wfStep}.${wt.accountId}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.seconds += wt.seconds;
        if (wt.sessionStartedAt != null) existing.unsubmitted = true;
      } else {
        grouped.set(key, {
          wfStep: wt.wfStep,
          accountId: wt.accountId,
          email: wt.email,
          seconds: wt.seconds,
          unsubmitted: wt.sessionStartedAt != null,
        });
      }
    }

    for (const [, entry] of grouped) {
      const showEmail = entry.email && entry.email !== "null" ? entry.email : `User ${entry.accountId}`;
      stats.push({
        key: `time.${entry.wfStep}.${entry.accountId}`,
        value: entry.seconds > 0 ? formatSeconds(entry.seconds) : "—",
        section: "time",
        sectionHeader: "Time",
        unitHeader: "Duration",
        label: showEmail,
        ...(entry.unsubmitted ? { tags: [{ label: "Unsubmitted", variant: "destructive" as const }] } : {}),
      });
    }

    return stats;
  }
}
