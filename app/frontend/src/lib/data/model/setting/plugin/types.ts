export interface Modality {
  label: string;
  description: string | null;
}

export interface Modalities {
  [modalityName: string]: Modality;
}

export interface Plugins {
  [pluginName: string]: Array<string>;
}

export interface ModalityShape {
  label: string;
  icon: string;
  /** Optional per-shape argument descriptions from the plugin manifest
   *  (`args`). Nothing reads it yet. */
  args?: Record<string, { type?: string; "x-identity-key"?: string; [key: string]: unknown }>;
}

export interface ModalityShapes {
  [modalityName: string]: ModalityShape;
}

export interface ModalityTagging {
  [taggingName: string]: ModalityShape;
}

export interface DatasetConfigField {
  key: string;
  label: string;
  type: "string" | "password" | "number" | "boolean";
  required?: boolean;
  placeholder?: string;
  description?: string;
  default?: string | number | boolean;
}

export interface DatasetConfigGroup {
  key: string;
  label: string;
  description?: string;
  fields: DatasetConfigField[];
}

export interface DatasetConfigSchema {
  /** The workflow name this config applies to */
  workflow: string;
  groups: DatasetConfigGroup[];
}
