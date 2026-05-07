import { IDAH_VIDEO_BOUNDING_BOX, IDAH_VIDEO_POLYGON } from "$lib/plugin/type";
import { interpolatePolygonAtFrame } from "$lib/components/App/Viewport/Shapes/Polygon/polygon-interpolation";

import type {
  AnnotationMetadata,
  AnnotationObj,
  AnnotationShape,
  AnnotationValue,
} from "$idah/context/annotation-context";
import type { DefaultMode, IdahVideoBoundingBox, IdahVideoPolygon } from "$lib/plugin/type";

export type Point = [number, number];

export type InterpolatedVertex = {
  point: Point;
  matched: boolean | null;
};

export type VideoShapeType = IdahVideoBoundingBox | IdahVideoPolygon;
export type VideoMode = DefaultMode | VideoShapeType;

export type VideoAnnotationObject = AnnotationObj<VideoShape, AnnotationValue, AnnotationMetadata>;
export type VideoFrameSelection = {
  frame: number;
  angle: number;
  aabb?: [number, number, number, number];
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
):
  | { points: Point[] | undefined; angle: number; aabb?: [number, number, number, number] }
  | { points: InterpolatedVertex[] | undefined; angle: number }
  | undefined {
  if (!shape.frames || shape.frames.length === 0) return; // no render (eg. entry:root)

  if (shape.start > current_frame || shape.end < current_frame) return;

  const foundFrame = shape.frames.find((v: VideoFrameSelection) => v.frame == current_frame);
  if (foundFrame || !interpolate) {
    // For polygon, wrap points in InterpolatedVertex with matched: true
    if (shape.type == IDAH_VIDEO_POLYGON && foundFrame?.points) {
      return {
        points: foundFrame.points.map((point: Point) => ({ point, matched: true })),
        angle: foundFrame.angle || 0,
      };
    }
    // For bounding box, convert AABB to 4 corner points
    if (shape.type == IDAH_VIDEO_BOUNDING_BOX && foundFrame?.aabb) {
      const [x1, y1, x2, y2] = foundFrame.aabb;
      return {
        points: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]] as Point[],
        angle: foundFrame.angle || 0,
        aabb: foundFrame.aabb,
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
    // interpolate AABB + angle between two frames
    const ratio = (current_frame - frame_start.frame) / (frame_end.frame - frame_start.frame);
    const aabb: [number, number, number, number] = [
      frame_start.aabb![0] + (frame_end.aabb![0] - frame_start.aabb![0]) * ratio,
      frame_start.aabb![1] + (frame_end.aabb![1] - frame_start.aabb![1]) * ratio,
      frame_start.aabb![2] + (frame_end.aabb![2] - frame_start.aabb![2]) * ratio,
      frame_start.aabb![3] + (frame_end.aabb![3] - frame_start.aabb![3]) * ratio,
    ];
    const [x1, y1, x2, y2] = aabb;
    return {
      aabb,
      points: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]] as Point[],
      angle: ((frame_end.angle || 0) - (frame_start.angle || 0)) * ratio + frame_start.angle,
    };
  } else if (shape.type == IDAH_VIDEO_POLYGON) {
    return {
      points: interpolatePolygonAtFrame(frame_start, frame_end, current_frame),
      angle: 0,
    };
  }
}
