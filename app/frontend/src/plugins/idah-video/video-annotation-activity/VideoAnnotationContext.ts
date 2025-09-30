import type {
  AnnotationMetadata,
  AnnotationObj,
  AnnotationShape,
  AnnotationValue,
} from "../../../lib/context/AnnotationContext";

export type Point = [number, number];

export type VideoShapeType = "video:bounding_box" | "video:bounding_polygon";
export type VideoMode = "view" | VideoShapeType;

export type VideoAnnotation = AnnotationObj<VideoShape, AnnotationValue, AnnotationMetadata>;
export type VideoFrameSelection = {
  frame: number;
  points: Point[];
};

export const ORIGIN: [0, 0] = [0, 0];
export const X = 0;
export const Y = 1;
export const WIDTH = X;
export const HEIGHT = Y;

export interface VideoShape extends AnnotationShape {
  type: string;
  start: number;
  end: number;
  frames: VideoFrameSelection[];
}

export interface BaseConfiguration {
  id: string;
  type: string;
  label: string;
  description: string;
}

export interface CategoryConfiguration extends BaseConfiguration {
  color: string;
  text_color: string;
}

export interface PropertyConfiguration extends BaseConfiguration {
  format: Format;
  required: boolean;
  selector: string[];
}

interface Format {
  maximum?: number | null;
  minimum?: number | null;
  step: number;
  options?: string[];
}

export interface TaggingConfiguration extends BaseConfiguration {
  format: Format;
  required: boolean;
}

export interface LabellingConfiguration {
  categories: CategoryConfiguration[];
  properties: PropertyConfiguration[];
  taggings: TaggingConfiguration[];
}
