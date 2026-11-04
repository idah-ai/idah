import type { Counts } from "@/data/model/dataset/projects/dashboard/record";
import type { DatasetRecord } from "@/data/model/dataset/dataset-record";

export function statusGroups(d: Counts) {
  return [
    { label: "Completed", value: d.completed, bgColor: "bg-emerald-500" },
    { label: "Reviewing", value: d.reviewing, bgColor: "bg-blue-500" },
    { label: "Pending review", value: d.pendingReview, bgColor: "bg-blue-200", textColor: "text-foreground" },
    { label: "Annotating", value: d.annotating, bgColor: "bg-amber-500" },
    { label: "Pending annotation", value: d.pendingAnnotation, bgColor: "bg-amber-200", textColor: "text-foreground" },
  ];
}

export function deliveryDate(value: string | null) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function deliveryStatus(date: string | null, counts: Pick<Counts, "total" | "completed">) {
  if (counts.total > 0 && counts.completed === counts.total)
    return { label: "Completed", color: "bg-green-50 text-green-700 dark:bg-green-600/15 dark:text-green-400" };
  if (!date) return { label: "No due date", color: "bg-muted text-muted-foreground" };

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const days = Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);
  return days < 0
    ? { label: "Overdue", color: "bg-destructive/10 text-destructive" }
    : days === 0
      ? { label: "Due today", color: "bg-orange-100 text-orange-800" }
      : days === 1
        ? { label: "Due tomorrow", color: "bg-amber-100 text-amber-800" }
        : { label: `Due in ${days} days`, color: "bg-primary/10 text-primary" };
}

export const datasetDeliveryDate = (record: DatasetRecord) => record.delivery_date ?? null;
