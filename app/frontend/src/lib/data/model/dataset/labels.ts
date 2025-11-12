import type { LabelValue } from "@/utils/types";
import {
  CircleCheckBigIcon,
  HashIcon,
  SquareCheckBigIcon,
  ToggleRightIcon,
  TypeIcon,
  type Icon as IconType,
} from "@lucide/svelte";
import type { ASTNode } from "../../../../plugins/idah-video/test_ast_resolution";

export type FieldTypeValue = "text" | "integer" | "boolean" | "single-select" | "multi-select";
export interface FieldType extends LabelValue<FieldTypeValue> {
  icon: typeof IconType;
}
export const fieldTypes: FieldType[] = [
  { label: "Text", value: "text", icon: TypeIcon },
  { label: "Number", value: "integer", icon: HashIcon },
  { label: "Switch", value: "boolean", icon: ToggleRightIcon },
  { label: "Single Select", value: "single-select", icon: CircleCheckBigIcon },
  { label: "Multiple Select", value: "multi-select", icon: SquareCheckBigIcon },
];

export type LabelPropertyOption = {
  id: string;
  label: string;
};

export interface LabelConfigurationProperty {
  id: string;
  type: FieldTypeValue;
  label: string;
  description: string;
  required: boolean;
  format: {
    minimum: number | null;
    maximum: number | null;
    step: number | null;
    info: string | null;
    options: Array<LabelPropertyOption>;
  };
  visibility: ASTNode | boolean;
}

export interface LabelConfigurationValue {
  id: string;
  color: string;
  label: string;
  text_color?: string;
}

export interface LabelingConfiguration {
  values: Array<LabelConfigurationValue>;
  properties: Array<LabelConfigurationProperty>;
}

export interface LabelConfigurations {
  [key: string]: LabelingConfiguration;
}

interface LabelColor {
  label: string;
  color: string;
  text_color: string;
}
export const labelColors: LabelColor[] = [
  { label: "Red", color: "#F6402B", text_color: "#FFFFFF" },
  { label: "Pink", color: "#EB1461", text_color: "#FFFFFF" },
  { label: "Purple", color: "#9C1AB2", text_color: "#FFFFFF" },
  { label: "Deep Purple", color: "#6A34BE", text_color: "#FFFFFF" },
  { label: "Blue", color: "#3C4DB7", text_color: "#FFFFFF" },
  { label: "Green", color: "#46AF4A", text_color: "#FFFFFF" },
  { label: "Teal", color: "#009687", text_color: "#000000" },
  { label: "Cyan", color: "#00BBD6", text_color: "#000000" },
  { label: "Sky Blue", color: "#00A6F5", text_color: "#000000" },
  { label: "Light Green", color: "#88C440", text_color: "#000000" },
  { label: "Lime", color: "#CCDD1D", text_color: "#000000" },
  { label: "Yellow", color: "#FFEC16", text_color: "#000000" },
  { label: "Amber", color: "#FFC100", text_color: "#000000" },
  { label: "Orange", color: "#FF9700", text_color: "#000000" },
  { label: "Red", color: "#FF5505", text_color: "#FFFFFF" },
  { label: "Brown", color: "#7A5447", text_color: "#FFFFFF" },
  { label: "Gray", color: "#828282", text_color: "#FFFFFF" },
  { label: "Black", color: "#000000", text_color: "#FFFFFF" },
];
