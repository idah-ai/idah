import type { CalendarDate } from "@internationalized/date";
export type Interval = "Day" | "Week" | "Month";
export type DashboardRange = { start: CalendarDate; end: CalendarDate };
export const rangeDays = (range: DashboardRange): number =>
  range.end.calendar.toJulianDay(range.end) - range.start.calendar.toJulianDay(range.start) + 1;
export const automaticInterval = (days: number): Interval => (days <= 14 ? "Day" : days <= 92 ? "Week" : "Month");
export const intervalAllowed = (interval: Interval, days: number): boolean =>
  interval === "Day" ? days <= 92 : interval === "Month" ? days >= 60 : true;
