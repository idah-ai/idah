import { today, fromDate, toCalendarDate, startOfWeek, startOfMonth, parseDate } from "@internationalized/date";
import type { CalendarDate } from "@internationalized/date";
export type Interval = "Day" | "Week" | "Month";
export type DashboardRange = { start: CalendarDate; end: CalendarDate };
export const rangeDays = (range: DashboardRange): number =>
  range.end.calendar.toJulianDay(range.end) - range.start.calendar.toJulianDay(range.start) + 1;
export const automaticInterval = (days: number): Interval => (days <= 14 ? "Day" : days <= 92 ? "Week" : "Month");
export const intervalAllowed = (interval: Interval, days: number): boolean =>
  interval === "Day" ? days <= 92 : interval === "Month" ? days >= 60 : true;

export type CompletionTrend = {
  status: "idle" | "loading" | "ready" | "empty" | "partial" | "unavailable";
  daily: { [date: string]: number };
  loaded: number;
  error: string;
  zone: string;
};
export type CompletionBucket = {
  key: string;
  start: CalendarDate;
  end: CalendarDate;
  count: number | null;
  clipped: boolean;
};

export const viewerTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;
export function initialCompletionRange(zone = viewerTimeZone()): DashboardRange {
  const end = today(zone);
  return { start: end.subtract({ days: 6 }), end };
}
export function completionBounds(
  range: DashboardRange,
  zone: string,
): { start: string; end: string; endInclusive: string } {
  if (range.start.compare(range.end) > 0) throw new Error("Invalid completion range");
  const end = range.end.add({ days: 1 }).toDate(zone);
  return {
    start: range.start.toDate(zone).toISOString(),
    end: end.toISOString(),
    // PostgreSQL stores microseconds; include the entire last millisecond.
    endInclusive: new Date(end.getTime() - 1).toISOString().replace(/\.999Z$/, ".999999Z"),
  };
}
export function completionDay(timestamp: Date, zone: string): string {
  if (!Number.isFinite(timestamp.getTime())) throw new Error("Invalid completion date");
  return toCalendarDate(fromDate(timestamp, zone)).toString();
}
export function completionBuckets(
  daily: { [date: string]: number },
  range: DashboardRange,
  interval: Interval,
  complete: boolean,
): CompletionBucket[] {
  const bucketStart = (date: CalendarDate): CalendarDate =>
    interval === "Week" ? startOfWeek(date, "en-GB") : interval === "Month" ? startOfMonth(date) : date;
  const totals: { [key: string]: number } = {};
  for (const [key, count] of Object.entries(daily)) {
    const date = parseDate(key);
    if (date.compare(range.start) < 0 || date.compare(range.end) > 0) continue;
    const bucket = bucketStart(date).toString();
    totals[bucket] = (totals[bucket] ?? 0) + count;
  }
  const result: CompletionBucket[] = [];
  let current = bucketStart(range.start);
  while (current.compare(range.end) <= 0) {
    const next = current.add(interval === "Month" ? { months: 1 } : interval === "Week" ? { weeks: 1 } : { days: 1 });
    const end = next.subtract({ days: 1 });
    result.push({
      key: current.toString(),
      clipped: current.compare(range.start) < 0 || end.compare(range.end) > 0,
      start: current.compare(range.start) < 0 ? range.start : current,
      end: end.compare(range.end) > 0 ? range.end : end,
      count: totals[current.toString()] ?? (complete ? 0 : null),
    });
    current = next;
  }
  return result;
}
