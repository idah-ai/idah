import type {
  AnnotationMetadata,
  AnnotationObj,
  AnnotationShape,
  AnnotationValue,
} from "../../../lib/context/AnnotationContext";

export type Point = [number, number];

export type VideoShapeType = "video:bounding_box" | "video:bounding_polygon";
export type VideoMode = "visual" | VideoShapeType;

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

export type CategoryConfiguration = {
  id: string;
  type: string;
  label: string;
  color: string;
  description: string;
};

export type PropertyConfiguration = {
  id: string;
  type: string;
  format: string;
  label: string;
  description: string;
  required: boolean;
  selector: string[];
};

export type LabellingConfiguration = {
  categories: CategoryConfiguration[];
  properties: PropertyConfiguration[];
};
