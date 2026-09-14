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
}

export interface ModalityShapes {
  [modalityName: string]: ModalityShape;
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
