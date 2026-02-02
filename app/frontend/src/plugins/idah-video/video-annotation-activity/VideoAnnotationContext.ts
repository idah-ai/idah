import type {
  AnnotationMetadata,
  AnnotationObj,
  AnnotationShape,
  AnnotationValue,
} from "../../../lib/context/AnnotationContext";
import type { DefaultMode, IdahVideoBoundingBox } from "../type";

export type Point = [number, number];

export type VideoShapeType = IdahVideoBoundingBox;
export type VideoMode = DefaultMode | VideoShapeType;

export type VideoAnnotation = AnnotationObj<VideoShape, AnnotationValue, AnnotationMetadata>;
export type VideoFrameSelection = {
  frame: number;
  angle: number;
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

export function getInterpolatedFrame(
  frames: VideoFrameSelection[],
  current_frame: number,
  interpolate: boolean = true,
): { points: Point[] | undefined; angle: number } | undefined {
  if (!frames) return;

  const foundShape = frames.find((v: VideoFrameSelection) => v.frame == current_frame);
  if (foundShape || !interpolate) return { points: foundShape?.points, angle: foundShape?.angle || 0 };

  const frame_start: VideoFrameSelection | null = frames.reduce(
    (acc: VideoFrameSelection | null, v: VideoFrameSelection) =>
      (!acc || acc.frame < v.frame) && v.frame < current_frame ? v : acc,
    null,
  );

  const frame_end: VideoFrameSelection | null = frames.reduce(
    (acc: VideoFrameSelection | null, v: VideoFrameSelection) =>
      (!acc || acc.frame > v.frame) && v.frame > current_frame ? v : acc,
    null,
  );

  if (frame_start && frame_end) {
    const ratio = (current_frame - frame_start.frame) / (frame_end.frame - frame_start.frame);
    return {
      points: frame_end.points.map((point, i) => [
        frame_start.points[i][X] + (point[X] - frame_start.points[i][X]) * ratio,
        frame_start.points[i][Y] + (point[Y] - frame_start.points[i][Y]) * ratio,
      ]),
      angle: ((frame_end.angle || 0) - (frame_start.angle || 0)) * ratio + (frame_start.angle || 0),
    };
  }
}
