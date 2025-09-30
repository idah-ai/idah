import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

export type VideoAnnotationTab = "categories" | "taggings";

export const videoAnnotationTabs: BaseTabs<VideoAnnotationTab> = [
  { label: "Categories", value: "categories" },
  { label: "Taggings", value: "taggings" },
];
