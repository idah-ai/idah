// ---------------------------------------------------------------------------
// frame-shift.ts — Shift an annotation's keyframes along the timeline and
// clamp to valid bounds, synthesizing boundary keyframes via interpolation
// when one end of the shifted range falls outside [minFrame, maxFrame].
//
// This is a pure, generic helper used by selection.paste to implement
// timeline-anchored copy/paste. It has no Svelte/store dependencies and is
// unit-testable in isolation.
// ---------------------------------------------------------------------------

import type { IVideoAnnotationShape, IVideoFrameSelection } from "$lib/types";
import { getInterpolatedFrame } from "$lib/utils/interpolation";

export interface ShiftAndClampResult {
  frames: IVideoFrameSelection[];
  start: number;
  end: number;
  /**
   * True when the entire shifted range falls outside [minFrame, maxFrame].
   * Should be unreachable when called from selection.paste, given that
   * command's copy-time bounds invariant — kept here only as a defensive
   * guard for a generic/reusable helper.
   */
  outOfBounds: boolean;
}

/**
 * Shift every keyframe of `shape` by `delta` frames, then clamp the result
 * to `[minFrame, maxFrame]`. If a boundary frame (minFrame or maxFrame) does
 * not already have a keyframe after the shift, one is synthesized by
 * interpolating the original shape's geometry at the corresponding
 * pre-shifted frame.
 *
 * @param shape  The original annotation shape (absolute frame numbers).
 * @param delta  pasteFrame - copyFrame (single scalar for the whole batch).
 * @param minFrame  Inclusive lower bound (typically 0).
 * @param maxFrame  Inclusive upper bound (typically media.totalFrames - 1).
 */
export function shiftAndClampShape(
  shape: IVideoAnnotationShape,
  delta: number,
  minFrame: number,
  maxFrame: number,
): ShiftAndClampResult {
  const shiftedStart = shape.start + delta;
  const shiftedEnd = shape.end + delta;

  // Entirely out of bounds — defensive only; see plan §2.3 step 2 for why
  // this should never be reachable from selection.paste.
  if (shiftedEnd < minFrame || shiftedStart > maxFrame) {
    return { frames: [], start: shiftedStart, end: shiftedEnd, outOfBounds: true };
  }

  const lowClip = shiftedStart < minFrame;
  const highClip = shiftedEnd > maxFrame;

  // Shift every keyframe, then drop anything outside the bounds.
  let frames = (shape.frames ?? [])
    .map((f) => ({ ...f, frame: f.frame + delta }))
    .filter((f) => f.frame >= minFrame && f.frame <= maxFrame);

  if (lowClip && !frames.some((f) => f.frame === minFrame)) {
    // Map the bound back into the ORIGINAL (unshifted) timeline to sample
    // the shape's geometry there, then re-tag it at the bound frame.
    const interpolated = getInterpolatedFrame(shape, minFrame - delta);
    if (interpolated) {
      frames.unshift({ frame: minFrame, angle: interpolated.angle ?? 0, points: interpolated.points ?? [] });
    }
  }
  if (highClip && !frames.some((f) => f.frame === maxFrame)) {
    const interpolated = getInterpolatedFrame(shape, maxFrame - delta);
    if (interpolated) {
      frames.push({ frame: maxFrame, angle: interpolated.angle ?? 0, points: interpolated.points ?? [] });
    }
  }

  frames.sort((a, b) => a.frame - b.frame);

  return {
    frames,
    start: frames[0]?.frame ?? Math.max(minFrame, shiftedStart),
    end: frames[frames.length - 1]?.frame ?? Math.min(maxFrame, shiftedEnd),
    outOfBounds: false,
  };
}