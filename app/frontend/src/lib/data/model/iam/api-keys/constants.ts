import type { BadgeVariant } from "@/components/ui/badge";
import type { LabelValue } from "@/utils/types";
import type { ApiKeyRecord } from "./record";

export const scopeTypes: LabelValue<string>[] = [
  { label: "All", value: "all" },
  { label: "Organization", value: "org" },
  { label: "Project", value: "project" },
];

export const apiKeyPermissions: LabelValue<string>[] = [
  { label: "Organization Read-Only", value: "read" },
  { label: "Organization Read-Write", value: "write" },
];

export interface ApiKeyStatusBadgeProps extends LabelValue<string, ApiKeyRecord> {
  variant: BadgeVariant;
}

export const apiKeyStatuses: ApiKeyStatusBadgeProps[] = [
  { label: "Active", value: "active", variant: "success" },
  { label: "Expired", value: "expired", variant: "outline" },
  { label: "Pending", value: "pending", variant: "warning" },
  { label: "Revoked", value: "revoked", variant: "destructive" },
];
