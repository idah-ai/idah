import type { Hash } from "@/utils/types";

export interface LabelCategoryConfiguration {
  id: string;
  type: string;
  color: string;
  label: string;
}

export interface LabelPropertyConfiguration {
  id: string;
  type: string;
  label: string;
  format: Hash;
  required: boolean;
  selector: Array<string>;
  description: string;
}

export interface LabelingConfiguration {
  categories: Array<LabelCategoryConfiguration>;
  properties: Array<LabelPropertyConfiguration>;
}
