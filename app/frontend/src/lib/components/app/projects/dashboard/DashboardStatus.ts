import { differenceInCalendarDays } from "date-fns";

import { DatasetRecord } from "@/data/model/dataset/dataset-record";

import type { Counts } from "@/components/app/projects/dashboard/DashboardData";

export function statusGroups(d: Counts): { label: string; value: number; bgColor: string; textColor?: string }[] {
  return [
    { label: "Completed", value: d.completed, bgColor: "bg-emerald-500" },
    { label: "Reviewing", value: d.reviewing, bgColor: "bg-blue-500" },
    { label: "Pending review", value: d.pendingReview, bgColor: "bg-blue-200", textColor: "text-foreground" },
    { label: "Annotating", value: d.annotating, bgColor: "bg-amber-500" },
    { label: "Pending annotation", value: d.pendingAnnotation, bgColor: "bg-amber-200", textColor: "text-foreground" },
  ];
}

export function deliveryDate(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function deliveryStatus(
  date: string | null,
  counts: Pick<Counts, "total" | "completed">,
  today: Date = new Date(),
) {
  if (counts.total > 0 && counts.completed === counts.total)
    return { label: "Completed", color: "bg-green-50 text-green-700 dark:bg-green-600/15 dark:text-green-400" };
  if (!date) return { label: "No due date", color: "bg-muted text-muted-foreground" };

  const days = differenceInCalendarDays(deliveryDate(date)!, today);
  return days < 0
    ? { label: "Overdue", color: "bg-destructive/10 text-destructive" }
    : days === 0
      ? { label: "Due today", color: "bg-orange-100 text-orange-800" }
      : days === 1
        ? { label: "Due tomorrow", color: "bg-amber-100 text-amber-800" }
        : { label: `Due in ${days} days`, color: "bg-primary/10 text-primary" };
}

export const datasetDeliveryDate = (record: DatasetRecord): string | null => record.delivery_date ?? null;
