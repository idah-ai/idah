import { DatasetRecord } from "@/data/model/dataset/dataset-record";

import type { BadgeVariant } from "@/components/ui/badge";
import type { LabelValue } from "@/utils/types";

export interface DatasetStatusBadgeProps extends LabelValue<string, DatasetRecord> {
  variant: BadgeVariant;
}

export const datasetsStatuses: DatasetStatusBadgeProps[] = [
  { label: "Pending", value: "pending", variant: "secondary" },
];
