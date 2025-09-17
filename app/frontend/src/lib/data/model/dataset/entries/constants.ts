import type { BadgeVariant } from "@/components/ui/badge";
import type { LabelValue } from "@/utils/types";
import type { EntryRecord } from "@/data/model/dataset/entries/record";

export interface EntryPriorityBadgeProps extends LabelValue<number, EntryRecord> {
  variant: BadgeVariant;
}

export const entryPriorities: EntryPriorityBadgeProps[] = [
  { label: "High", value: -1, variant: "destructive" },
  { label: "Medium", value: 0, variant: "outline" },
  { label: "Low", value: 1, variant: "secondary" },
];

export interface EntryStatusBadgeProps extends LabelValue<string, EntryRecord> {
  variant: BadgeVariant;
}

export const entryStatuses: EntryStatusBadgeProps[] = [
  { label: "Processing", value: "processing", variant: "secondary" },
  { label: "Pending", value: "pending", variant: "secondary" },
  { label: "Ready", value: "ready", variant: "default" },
  { label: "Assigned", value: "assigned", variant: "outline" },
  { label: "In Progress", value: "in_progress", variant: "outline" },
  { label: "Completed", value: "completed", variant: "outline" },
  { label: "Errored", value: "errored", variant: "destructive" },
];

interface EntryWorkflowStep extends LabelValue<string, EntryRecord> {}
export const entryWorkflowSteps: EntryWorkflowStep[] = [
  { label: "Start", value: "start" },
  { label: "Annotate", value: "annotate" },
  { label: "Review", value: "review" },
  { label: "Export", value: "export" },
];
