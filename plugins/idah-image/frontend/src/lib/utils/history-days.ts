// ---------------------------------------------------------------------------
// history-days.ts — group a page of history changes under day headings.
//
// Pure and testable: `now` is injected. The page's changes arrive newest first,
// so consecutive changes sharing a day are grouped together.
// ---------------------------------------------------------------------------
import type { IAnnotationChange } from "$idah/v2/types";

export interface HistoryDayGroup {
  label: string;
  items: IAnnotationChange[];
}

/** Day key built from local date components via UTC, so day arithmetic is DST-safe. */
function dayKey(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatLocalDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/**
 * Group a page of changes (newest first) under day headings: "Today",
 * "Yesterday", then the local date (e.g. "Mon 3 Nov 2026").
 */
export function groupChangesByDay(changes: IAnnotationChange[], now: Date): HistoryDayGroup[] {
  const today = dayKey(now);
  const yesterday = today - 86_400_000;
  const groups: HistoryDayGroup[] = [];
  for (const change of changes) {
    const date = new Date(change.changed_at);
    const day = dayKey(date);
    let label: string;
    if (day === today) label = "Today";
    else if (day === yesterday) label = "Yesterday";
    else label = formatLocalDate(date);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(change);
    else groups.push({ label, items: [change] });
  }
  return groups;
}
