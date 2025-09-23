import type { Hash, LabelValue } from "@/utils/types";
import { CircleCheckBigIcon, HashIcon, SquareCheckBigIcon, TypeIcon, type Icon as IconType } from "@lucide/svelte";

export type PropertyType = "text" | "integer" | "boolean" | "single-select" | "multi-select";
export interface LabelPropertyType extends LabelValue<PropertyType> {
  icon: typeof IconType;
}
export const labelPropertyTypes: LabelPropertyType[] = [
  { label: "Text field", value: "text", icon: TypeIcon },
  { label: "Number field", value: "integer", icon: HashIcon },
  { label: "Single select field", value: "single-select", icon: CircleCheckBigIcon },
  { label: "Multi select field", value: "multi-select", icon: SquareCheckBigIcon },
];

export interface LabelCategoryConfiguration {
  id: string;
  type: string;
  color: string;
  text_color?: string;
  label: string;
}

export interface LabelPropertyConfiguration {
  id: string;
  type: PropertyType;
  label: string;
  format: {
    minimum: number | null;
    maximum: number | null;
    options: Array<string>;
  };
  required: boolean;
  selector: Array<string>;
  description: string;
}

export interface LabelingConfiguration {
  categories: Array<LabelCategoryConfiguration>;
  properties: Array<LabelPropertyConfiguration>;
}
