import type { BadgeVariant } from "@/components/ui/badge";
import type { SyncJobRecord } from "@/data/model/sync/jobs/record";
import type { LabelValue } from "@/utils/types";

export interface SyncJobStatusBadgeProps extends LabelValue<string, SyncJobRecord> {
  variant: BadgeVariant;
}

export const syncJobStatuses: SyncJobStatusBadgeProps[] = [
  { label: "Pending", value: "pending", variant: "warning" },
  { label: "Processing", value: "processing", variant: "default" },
  { label: "Completed", value: "completed", variant: "success" },
  { label: "Errored", value: "errored", variant: "destructive" },
];
