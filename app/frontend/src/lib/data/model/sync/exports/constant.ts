import type { LabelValue } from "@/utils/types";

export const includeMedias: Array<LabelValue<string>> = [
  {
    label: "No medias",
    value: "none",
    description: "No media files will be exported.",
  },
  {
    label: "Original medias",
    value: "original",
    description: "Only original media files will be exported.",
  },
  {
    label: "All medias",
    value: "all",
    description: "Original and other processed media files will be exported.",
  },
];
