export interface Modality {
  label: string;
  description: string | null;
  /** System shapes declared by the plugin (e.g. idah-image's "done-area"):
   *  produced by the plugin itself rather than drawn by annotators, so they
   *  are not configurable tools and are excluded from core entry stats.
   *  Key is snake_case: the setting API passes manifest fields through as-is. */
  system_shapes?: Record<string, ModalityShape>;
}

export interface Modalities {
  [modalityName: string]: Modality;
}

export interface Plugins {
  [pluginName: string]: Array<string>;
}

export interface ModalityShape {
  label: string;
  /** Optional: the backend passes `icon: null` through for shapes without one. */
  icon?: string | null;
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
