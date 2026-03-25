import type { BadgeVariant } from "@/components/ui/badge";
import type { ApiKeyRecord } from "@/data/model/iam/api-keys/record";
import type { LabelValue } from "@/utils/types";

export const orgOwnersScopeTypes: LabelValue<string>[] = [
  { label: "Organization", value: "org" },
  { label: "Project", value: "project" },
];

export const adminsScopeTypes: LabelValue<string>[] = [...orgOwnersScopeTypes, { label: "All", value: "all" }];

export const apiKeyPermissions: LabelValue<string>[] = [
  { label: "Organization Read-Only", value: "read" },
  { label: "Organization Read-Write", value: "write" },
];

export interface ApiKeyStatusBadgeProps extends LabelValue<string, ApiKeyRecord> {
  variant: BadgeVariant;
}

export const apiKeyStatuses: ApiKeyStatusBadgeProps[] = [
  { label: "Active", value: "active", variant: "success" },
  { label: "Expired", value: "expired", variant: "gray" },
  { label: "Pending", value: "pending", variant: "warning" },
  { label: "Revoked", value: "revoked", variant: "destructive" },
];
