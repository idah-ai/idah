import { browser } from "$app/environment";
import { readable } from "svelte/store";
import { addDays, isBefore, parseISO, startOfDay } from "date-fns";

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
