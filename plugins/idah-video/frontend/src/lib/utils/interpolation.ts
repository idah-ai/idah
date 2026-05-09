// ---------------------------------------------------------------------------
// Video interpolation helpers
// Given a list of keyframes and a frame number, returns the interpolated
// geometry (points & angle) at that frame.
// ---------------------------------------------------------------------------

import type { IVideoAnnotationShape, IVideoFrameSelection } from "$idah/v2/video-types";
import { VIDEO_BOUNDING_BOX } from "$idah/v2/video-types";
import type { Point } from "$lib/utils/math/point";
import { interpolatePolygon } from "$lib/utils/math/polygon";

/**
 * Simple per-point linear interpolation (lerp).
 * Assumes both arrays have the same length.
 */
function lerpPoints(a: Point[], b: Point[], t: number): Point[] {
  return a.map((p, i) => [
    p[0] + (b[i][0] - p[0]) * t,
    p[1] + (b[i][1] - p[1]) * t,
  ] as Point);
}

/** Given a list of keyframes and a frame number, return [frame_before, frame_after]. */
function getSurroundingKeyFrames(
  frames: IVideoFrameSelection[],
  current: number,
): [IVideoFrameSelection, IVideoFrameSelection] | null {
  let before: IVideoFrameSelection | null = null;
  let after: IVideoFrameSelection | null = null;

  for (const f of frames) {
    if (f.frame < current && (!before || f.frame > before.frame)) before = f;
    if (f.frame > current && (!after || f.frame < after.frame)) after = f;
  }

  return before && after ? [before, after] : null;
}

/**
 * Given an annotation shape and a frame number, return the interpolated
 * geometry (points & angle) at that frame.
 */
export function getInterpolatedFrame(
  shape: IVideoAnnotationShape,
  current_frame: number,
  interpolate: boolean = true,
):
  | { points: Point[] | undefined; angle: number }
  | undefined {
  if (!shape.frames?.length) return;
  if (shape.start > current_frame || shape.end < current_frame) return;

  const exact = shape.frames.find((v) => v.frame === current_frame);
  if (exact || !interpolate) {
    return { points: exact?.points, angle: exact?.angle || 0 };
  }

  const surrounding = getSurroundingKeyFrames(shape.frames, current_frame);
  if (!surrounding) return;
  const [before, after] = surrounding;

  const t = (current_frame - before.frame) / (after.frame - before.frame);
  const angle = ((after.angle || 0) - (before.angle || 0)) * t + (before.angle || 0);

  if (shape.type === VIDEO_BOUNDING_BOX) {
    return { points: lerpPoints(before.points!, after.points!, t), angle };
  }

  return { points: interpolatePolygon(before.points!, after.points!, t), angle };
}
