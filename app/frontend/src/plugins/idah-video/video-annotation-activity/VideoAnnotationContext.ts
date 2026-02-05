import type {
  AnnotationMetadata,
  AnnotationObj,
  AnnotationShape,
  AnnotationValue,
} from "../../../lib/context/AnnotationContext";
import type { DefaultMode, IdahVideoBoundingBox, IdahPolygon } from "../type";
import { IDAH_POLYGON, IDAH_VIDEO_BOUNDING_BOX } from "../type";

import { interpolatePolygonAtFrame } from "./polygonInterpolation";

export type Point = [number, number];

export type InterpolatedVertex = {
  point: Point;
  matched: boolean;
};

export type VideoShapeType = IdahVideoBoundingBox | IdahPolygon;
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
  shape: VideoShape,
  current_frame: number,
  interpolate: boolean = true,
): { points: Point[] | undefined; angle: number } | { points: InterpolatedVertex[] | undefined; angle: number } | undefined {
  if (!shape.frames || shape.frames.length === 0) return; // no render (eg. entry:root)

  if (shape.start > current_frame || shape.end < current_frame) return;

  const foundFrame = shape.frames.find((v: VideoFrameSelection) => v.frame == current_frame);
  if (foundFrame || !interpolate) {
    // For polygon, wrap points in InterpolatedVertex with matched: true
    if (shape.type == IDAH_POLYGON && foundFrame?.points) {
      return {
        points: foundFrame.points.map((point: Point) => ({ point, matched: true })),
        angle: foundFrame.angle || 0,
      };
    }
    return { points: foundFrame?.points, angle: foundFrame?.angle || 0 }; // exists!
  }

  const frame_start: VideoFrameSelection | null = shape.frames.reduce(
    (acc: VideoFrameSelection | null, v: VideoFrameSelection) =>
      (!acc || acc.frame < v.frame) && v.frame < current_frame ? v : acc,
    null,
  );

  const frame_end: VideoFrameSelection | null = shape.frames.reduce(
    (acc: VideoFrameSelection | null, v: VideoFrameSelection) =>
      (!acc || acc.frame > v.frame) && v.frame > current_frame ? v : acc,
    null,
  );

  if (!frame_start || !frame_end) return;

  if (shape.type == IDAH_VIDEO_BOUNDING_BOX) {
    // interpolate from within bounds
    const ratio = (current_frame - frame_start.frame) / (frame_end.frame - frame_start.frame);
    return {
      points: frame_end.points.map((point, i) => [
        frame_start.points[i][X] + (point[X] - frame_start.points[i][X]) * ratio,
        frame_start.points[i][Y] + (point[Y] - frame_start.points[i][Y]) * ratio,
      ]),
      angle: ((frame_end.angle || 0) - (frame_start.angle || 0)) * ratio + frame_start.angle,
    };
  } else if (shape.type == IDAH_POLYGON) {
    return {
      points: interpolatePolygonAtFrame(frame_start, frame_end, current_frame),
      angle: 0
    };
  }
}
