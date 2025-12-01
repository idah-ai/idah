import { DatasetRecord } from "@/data/model/dataset/dataset-record";

import { VideoIcon, type Icon as IconType } from "@lucide/svelte";

import type { BadgeVariant } from "@/components/ui/badge";
import type { LabelValue } from "@/utils/types";

export interface DatasetModalityBadgeProps extends LabelValue<string, DatasetRecord> {
  icon: typeof IconType;
  variant: BadgeVariant;
}

export const datasetsModalities: DatasetModalityBadgeProps[] = [
  // { label: "Image", value: "image", icon: ImageIcon, variant: "secondary" },
  { label: "Video", value: "idah-video", icon: VideoIcon, variant: "default" },
];

export interface DatasetStatusBadgeProps extends LabelValue<string, DatasetRecord> {
  variant: BadgeVariant;
}

export const datasetsStatuses: DatasetStatusBadgeProps[] = [
  { label: "Pending", value: "pending", variant: "warning" },
  { label: "Completed", value: "completed", variant: "outline" },
];
