import { IDAH_VIDEO_BOUNDING_BOX, IDAH_VIDEO_POLYGON } from "$lib/plugin/type";
import { interpolatePolygon } from "$lib/utils/math/polygon";
import { interpolateBBox, bboxToPoints } from "$lib/utils/math/bbox";
import type { Point, InterpolatedVertex } from "$lib/utils/math/point";

import type {
  AnnotationMetadata,
  AnnotationObj,
  AnnotationShape,
  AnnotationValue,
} from "$idah/context/annotation-context";

export type VideoAnnotationObject = AnnotationObj<VideoShape, AnnotationValue, AnnotationMetadata>;
export type VideoFrameSelection = {
  frame: number;
  angle: number;
  aabb?: [number, number, number, number];
  points: Point[];
};

export interface VideoShape extends AnnotationShape {
  type: string;
  start: number;
  end: number;
  frames: VideoFrameSelection[];
}

export function getInterpolatedFrame(
  shape: VideoShape,
  current_frame: number,
  interpolate: boolean = true,
):
  | { points: Point[] | undefined; angle: number; aabb?: [number, number, number, number] }
  | { points: InterpolatedVertex[] | undefined; angle: number }
  | undefined {
  if (!shape.frames?.length) return;
  if (shape.start > current_frame || shape.end < current_frame) return;

  const exact = shape.frames.find((v) => v.frame === current_frame);
  if (exact || !interpolate) {
    if (shape.type === IDAH_VIDEO_POLYGON && exact?.points) {
      return {
        points: exact.points.map((p) => ({ point: p, matched: true })),
        angle: exact.angle || 0,
      };
    }
    if (shape.type === IDAH_VIDEO_BOUNDING_BOX && exact?.aabb) {
      return {
        points: bboxToPoints(exact.aabb),
        angle: exact.angle || 0,
        aabb: exact.aabb,
      };
    }
    return { points: exact?.points, angle: exact?.angle || 0 };
  }

  // Find surrounding keyframes for interpolation
  const before = shape.frames.reduce(
    (best, v) => (!best || best.frame < v.frame) && v.frame < current_frame ? v : best,
    null as VideoFrameSelection | null,
  );
  const after = shape.frames.reduce(
    (best, v) => (!best || best.frame > v.frame) && v.frame > current_frame ? v : best,
    null as VideoFrameSelection | null,
  );
  if (!before || !after) return;

  const t = (current_frame - before.frame) / (after.frame - before.frame);

  if (shape.type === IDAH_VIDEO_BOUNDING_BOX) {
    const aabb = interpolateBBox(before.aabb!, after.aabb!, t);
    const angle = ((after.angle || 0) - (before.angle || 0)) * t + before.angle;
    return { aabb, points: bboxToPoints(aabb), angle };
  }

  if (shape.type === IDAH_VIDEO_POLYGON) {
    return { points: interpolatePolygon(before.points, after.points, t), angle: 0 };
  }

  return;
}
