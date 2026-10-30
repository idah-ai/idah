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
   *  (`args`). The history UI will use it to label keyed paths; nothing
   *  reads it yet. */
  args?: Record<string, { type?: string; "x-identity-key"?: string; [key: string]: unknown }>;
}

export interface ModalityShapes {
  [modalityName: string]: ModalityShape;
}

export interface ModalityTagging {
  [taggingName: string]: ModalityShape;
}
