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
  { label: "Pending", value: "pending", variant: "outline" },
  { label: "Ready", value: "ready", variant: "default" },
];
