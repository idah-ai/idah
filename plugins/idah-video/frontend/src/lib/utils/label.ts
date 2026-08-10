// ---------------------------------------------------------------------------
// label.ts — Category label text and anchor geometry for on-canvas labels
//
// Sibling of color.ts, and deliberately shaped the same way: a pure function
// that takes an injected category lookup, plus a thin `resolve*` convenience
// wrapper that reads the driver config. Keeping the lookup injectable is what
// makes this testable — getDriver() throws when no driver is initialised.
//
// NOTE: Keep this file in sync with plugins/idah-image/frontend/src/lib/utils/label.ts.
// The video variant differs in one way: geometry is per-frame, so the anchor is
// resolved through getInterpolatedFrame() rather than read off shape.points.
// ---------------------------------------------------------------------------
import { getDriver } from "$lib/state/driver.svelte";
import { VIDEO_BOUNDING_BOX, VIDEO_POLYGON, type IVideoAnnotationShape } from "$lib/types";
import { categoryValueToLabel } from "$lib/utils/annotation";
import { getInterpolatedFrame } from "$lib/utils/interpolation";
import { centroid, rotatePoint, type Point } from "$lib/utils/math/point";

/** Minimal structural view of an annotation — avoids coupling to the full record type. */
type LabelAnnotation = {
  id?: string;
  value?: { category?: string };
  shape?: { type?: string };
};

/** A resolved category label. `unresolved` means the id is not in the label config. */
export interface AnnotationLabel {
  text: string;
  unresolved: boolean;
}

/** Uppercase the first character, matching categoryValueToLabel's own segment casing. */
function capitalize(s: string): string {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

/** Last segment of a category path ("vehicle/commercial/truck" → "truck"). */
function leafOf(categoryId: string): string {
  return categoryId.split("/").pop() ?? categoryId;
}

/**
 * Resolve the label text for an annotation.
 *
 * Returns null when the annotation has no category at all — a floating
 * "Uncategorized" is noise on canvas. A category that IS set but missing from
 * the label config is a real data problem, so it renders the raw path with
 * `unresolved: true` rather than being silently hidden.
 *
 * @param getCategory Looks up a category id in the label config.
 */
export function annotationLabel(
  annotation: LabelAnnotation,
  getCategory: (categoryId: string) => { id: string; label?: string | null } | null | undefined,
): AnnotationLabel | null {
  const raw = annotation?.value?.category;
  if (!raw) return null;

  const category = getCategory(raw);

  // NOTE: categoryValueToLabel(value) with ONE argument POPS the leaf segment —
  // it is a parent-path helper. The second argument replaces the leaf instead,
  // which is what yields the full path. Dropping it silently truncates every
  // label; see the regression test in label.spec.ts.
  if (category) {
    return {
      text: categoryValueToLabel(category.id, category.label || capitalize(leafOf(category.id))),
      unresolved: false,
    };
  }

  return { text: categoryValueToLabel(raw, capitalize(leafOf(raw))), unresolved: true };
}

/** Convenience wrapper resolving the category against the driver's label config. */
export function resolveAnnotationLabel(annotation: LabelAnnotation): AnnotationLabel | null {
  return annotationLabel(annotation, (categoryId: string) => {
    const config = getDriver().config[annotation?.shape?.type ?? ""];
    return config?.values?.find((v) => v.id === categoryId) ?? null;
  });
}

/**
 * Top-left corner of the annotation's axis-aligned bounding box, in media pixels,
 * for the given frame.
 *
 * Video geometry lives in keyframes, so points come from getInterpolatedFrame
 * rather than shape.points — the anchor has to follow the interpolated position
 * as the user scrubs, not sit at some stored keyframe.
 *
 * Returns null when the annotation has no geometry at this frame (outside its
 * start/end range, or a keyframe with no points), and for unrecognised shapes.
 */
export function labelAnchorPx(
  annotation: { shape?: unknown },
  w: number,
  h: number,
  frame: number,
): Point | null {
  const shape = annotation?.shape as (IVideoAnnotationShape & { type?: string }) | undefined;
  if (!shape) return null;

  const frameData = getInterpolatedFrame(shape, frame);
  const points = (frameData?.points ?? []) as Point[];
  if (points.length === 0) return null;

  switch (shape.type) {
    case VIDEO_BOUNDING_BOX: {
      // 4 unrotated AABB corners per keyframe, plus a per-frame angle.
      if (points.length < 4) return null;
      const angle = frameData?.angle ?? 0;
      if (!angle) return minCornerPx(points, w, h);
      // Rotate in pixel space: the shape's on-screen rotation is about its
      // pixel centroid, so normalized coords must be converted first or the
      // result skews on any non-square video.
      const cornersPx = points.map(([x, y]): Point => [x * w, y * h]);
      const cPx = centroid(cornersPx);
      return minPx(cornersPx.map((p) => rotatePoint(p, cPx, angle)));
    }

    case VIDEO_POLYGON: {
      if (points.length < 2) return null;
      return minCornerPx(points, w, h);
    }

    default:
      return null;
  }
}

/** (min x, min y) of normalized points, converted to media pixels. */
function minCornerPx(points: Point[], w: number, h: number): Point {
  const [minX, minY] = minPx(points);
  return [minX * w, minY * h];
}

/** (min x, min y) of points, in whatever space they were given. */
function minPx(points: Point[]): Point {
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  return [minX, minY];
}
