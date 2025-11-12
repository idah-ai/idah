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
