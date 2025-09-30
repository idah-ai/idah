import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

export type VideoAnnotationTab = "categories" | "properties" | "taggings";

export const videoAnnotationTabs: BaseTabs<VideoAnnotationTab> = [
  { label: "Categories", value: "categories" },
  { label: "Properties", value: "properties" },
  { label: "Taggings", value: "taggings" },
];
