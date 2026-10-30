import { isBefore, parseISO, startOfDay } from "date-fns";

/** A delivery date becomes overdue on the following day in the device's local timezone. */
export function isOverdue(date: Date | string | null | undefined, today: Date = new Date()): boolean {
  if (!date) return false;

  const value = typeof date === "string" ? parseISO(date) : date;
  return isBefore(startOfDay(value), startOfDay(today));
}
