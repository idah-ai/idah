import type { BadgeVariant } from "@/components/ui/badge";
import type { EntryRecord } from "@/data/model/dataset/entries/record";
import type { LabelValue } from "@/utils/types";

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

export type EntryWorkflowStep = "start" | "annotate" | "review" | "done" | "export";
export type EntryStatus = "pending" | "processing" | "ready" | "assigned" | "in_progress" | "completed" | "errored";

export interface EntryStatusBadgeProps extends LabelValue<string, EntryRecord> {
  variant: BadgeVariant;
}

export const entryStatuses: EntryStatusBadgeProps[] = [
  { label: "Processing", value: "processing", variant: "gray" },
  { label: "Pending", value: "pending", variant: "gray" },
  { label: "Ready", value: "ready", variant: "default" },
  { label: "In Progress", value: "in_progress", variant: "warning" },
  { label: "Completed", value: "completed", variant: "success" },
  { label: "Errored", value: "errored", variant: "destructive" },
];

interface EntryWorkflowStepBadgeProps extends LabelValue<string, EntryRecord> {
  variant?: BadgeVariant;
}
export const entryWorkflowSteps: EntryWorkflowStepBadgeProps[] = [
  { label: "Start", value: "start" },
  { label: "Annotate", value: "annotate" },
  { label: "Review", value: "review" },
  { label: "Export", value: "export" },
];
