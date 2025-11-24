import type { LabelValue } from "@/components/app/types";
import type { BadgeVariant } from "@/components/ui/badge";

export const auditResourceTypes: LabelValue<string>[] = [
  { label: "Annotations", value: "dataset:annotations" },
  { label: "Datasets", value: "dataset:datasets" },
  { label: "Entries", value: "dataset:entries" },
];

export type AuditAction = "create" | "update" | "delete";
export interface IAuditAction extends LabelValue<AuditAction> {
  badgeVariant: BadgeVariant;
}
export const auditActions: IAuditAction[] = [
  { label: "Create", value: "create", badgeVariant: "success" },
  { label: "Update", value: "update", badgeVariant: "default" },
  { label: "Delete", value: "delete", badgeVariant: "destructive" },
];
