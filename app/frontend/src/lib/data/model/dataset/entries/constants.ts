import type { BadgeVariant } from "@/components/ui/badge";
import type { LabelValue } from "@/utils/types";
import type { EntryRecord } from "@/data/model/dataset/entries/record";

export interface EntryPriorityBadgeProps extends LabelValue<number, EntryRecord> {
  iconColor: string;
  variant: BadgeVariant;
}

export const entryPriorities: EntryPriorityBadgeProps[] = [
  {
    label: "Urgent",
    value: -2,
    iconColor: "#FF4500", // OrangeRed
    variant: "destructive",
  },
  {
    label: "High",
    value: -1,
    iconColor: "#FFA500", // Orange
    variant: "warning",
  },
  {
    label: "Medium",
    value: 0,
    iconColor: "#1E90FF", // DodgerBlue
    variant: "default",
  },
  {
    label: "Low",
    value: 1,
    iconColor: "#D3D3D3", // Lightgray
    variant: "secondary",
  },
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

interface EntryWorkflowStep extends LabelValue<string, EntryRecord> {
  variant?: BadgeVariant;
}
export const entryWorkflowSteps: EntryWorkflowStep[] = [
  { label: "Start", value: "start" },
  { label: "Annotate", value: "annotate" },
  { label: "Review", value: "review" },
  { label: "Export", value: "export" },
];
