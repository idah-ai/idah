import { browser } from "$app/environment";
import { fromStore, readable } from "svelte/store";
import { addDays, differenceInCalendarDays, isBefore, isValid, parseISO, startOfDay } from "date-fns";
import type { BadgeConfig } from "@/utils/badgeMap";

export const today = readable(startOfDay(new Date()), (set) => {
  if (!browser) return;

  let timer: ReturnType<typeof setTimeout>;
  const refresh = () => {
    clearTimeout(timer);
    const now = new Date();
    set(startOfDay(now));
    timer = setTimeout(refresh, startOfDay(addDays(now, 1)).getTime() - now.getTime());
  };

  refresh();
  window.addEventListener("focus", refresh);
  return () => {
    clearTimeout(timer);
    window.removeEventListener("focus", refresh);
  };
});

/** A delivery date becomes overdue on the following day in the device's local timezone. */
export function isOverdue(date: Date | string | null | undefined, today: Date = new Date()): boolean {
  if (!date) return false;

  const value = typeof date === "string" ? parseISO(date) : date;
  return isBefore(startOfDay(value), startOfDay(today));
}

export type DeliveryStatusBadgeProps = BadgeConfig & {
  value: "completed" | "due_tomorrow" | "due_today" | "upcoming" | "overdue" | "no_due_date";
};

const reportingDay = fromStore(today);

export function getDeliveryStatusBadge(
  deliveryDate: string | null | undefined,
  completed: boolean,
  day: Date = reportingDay.current,
): DeliveryStatusBadgeProps {
  if (completed) return { label: "Completed", value: "completed", variant: "success" };

  const date = deliveryDate ? parseISO(deliveryDate) : null;
  if (!date || !isValid(date)) return { label: "No due date", value: "no_due_date", variant: "gray" };

  const days = differenceInCalendarDays(date, day);
  if (days < 0) return { label: "Overdue", value: "overdue", variant: "destructive" };
  if (days === 0) return { label: "Due today", value: "due_today", variant: "orange" };
  if (days === 1) return { label: "Due tomorrow", value: "due_tomorrow", variant: "warning" };
  return { label: `Due in ${days} days`, value: "upcoming", variant: "default" };
}
