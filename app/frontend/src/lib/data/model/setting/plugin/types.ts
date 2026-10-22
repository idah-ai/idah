export interface Modality {
  label: string;
  description: string | null;
  // Media files the plugin handles (extensions or MIME patterns); null = no restriction declared.
  accepted_file_types: string[] | null;
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

export interface ModalityTagging {
  [taggingName: string]: ModalityShape;
}
