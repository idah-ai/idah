import { DatasetRecord } from "@/data/model/dataset/dataset-record";

import { ImageIcon, VideoIcon, type Icon as IconType } from "@lucide/svelte";

import type { BadgeVariant } from "@/components/ui/badge";
import type { LabelValue } from "@/utils/types";

export interface DatasetModalityBadgeProps extends LabelValue<string, DatasetRecord> {
  icon: typeof IconType;
  variant: BadgeVariant;
}

export const datasetsModalities: DatasetModalityBadgeProps[] = [
  { label: "Image", value: "idah-image", icon: ImageIcon, variant: "default" },
  { label: "Video", value: "idah-video", icon: VideoIcon, variant: "default" },
  { label: "Image", value: "idah-image", icon: ImageIcon, variant: "info" },
];

export interface DatasetStatusBadgeProps extends LabelValue<string, DatasetRecord> {
  variant: BadgeVariant;
}

export const datasetsStatuses: DatasetStatusBadgeProps[] = [
  { label: "Pending", value: "pending", variant: "outline" },
  { label: "In Progress", value: "in_progress", variant: "warning" },
  { label: "Completed", value: "completed", variant: "success" },
];
