// ---------------------------------------------------------------------------
// label.ts — Category label text and anchor geometry for on-canvas labels
//
// Sibling of color.ts, and deliberately shaped the same way: a pure function
// that takes an injected category lookup, plus a thin `resolve*` convenience
// wrapper that reads the driver config. Keeping the lookup injectable is what
// makes this testable — getDriver() throws when no driver is initialised.
// ---------------------------------------------------------------------------
import { getDriver } from "$lib/state/driver.svelte";
import { IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_LINE, IMAGE_POLYGON } from "$lib/types";
import { categoryValueToLabel } from "$lib/utils/annotation";
import { centroid, rotatePoint, type Point } from "$lib/utils/math/point";

/** Minimal structural view of an annotation — avoids coupling to the full record type. */
type LabelAnnotation = {
  id?: string;
  value?: { category?: string };
  shape?: { type?: string; points?: number[][]; angle?: number; radius?: number };
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
 * Top-left corner of the annotation's axis-aligned bounding box, in media pixels.
 *
 * One rule for every shape at every angle. For rotated bbox/ellipse this is the
 * AABB of the ROTATED corners: the label renders in a separate layer that does
 * not inherit the shape's CSS `transform: rotate()`, so the rotation has to be
 * applied to the anchor explicitly or the label drifts off the shape.
 *
 * Returns null for masks (drawn to canvas, excluded from labelling) and for any
 * shape whose points are missing or malformed.
 */
export function labelAnchorPx(annotation: LabelAnnotation, w: number, h: number): Point | null {
  const shape = annotation?.shape;
  const points = (shape?.points ?? []) as Point[];

  switch (shape?.type) {
    case IMAGE_BOUNDING_BOX: {
      // Stored as 4 unrotated AABB corners plus a separate `angle`.
      if (points.length < 4) return null;
      const angle = shape.angle ?? 0;
      if (!angle) return minCornerPx(points, w, h);
      // Rotate in pixel space: the shape's on-screen rotation is about its
      // pixel centroid, so normalized coords must be converted first or the
      // result skews on any non-square image. (The Shapes/ helper rotatePointN
      // does the same round-trip; working in px directly keeps this module
      // free of a dependency on the component tree.)
      const cornersPx = points.map(([x, y]): Point => [x * w, y * h]);
      const cPx = centroid(cornersPx);
      return minPx(cornersPx.map((p) => rotatePoint(p, cPx, angle)));
    }

    case IMAGE_ELLIPSE: {
      // Stored as [[cx, cy], [rx, ry]] + angle — centroid and radii, NOT the
      // 4 AABB corners. EllipseShape derives the corner form at runtime for
      // editing only (ellipseAABB), and converts back before persisting.
      if (points.length < 2) return null;
      const [cx, cy] = points[0];
      const [rx, ry] = points[1];
      const angle = shape.angle ?? 0;
      if (!angle) return [(cx - rx) * w, (cy - ry) * h];

      // Rotate the same corner set ellipseAABB() produces, about the centroid
      // in pixel space, so a rotated ellipse anchors consistently with a
      // rotated bounding box.
      const cPx: Point = [cx * w, cy * h];
      const cornersPx: Point[] = [
        [(cx - rx) * w, (cy - ry) * h],
        [(cx + rx) * w, (cy - ry) * h],
        [(cx + rx) * w, (cy + ry) * h],
        [(cx - rx) * w, (cy + ry) * h],
      ];
      return minPx(cornersPx.map((p) => rotatePoint(p, cPx, angle)));
    }

    case IMAGE_CIRCLE: {
      // points = [[cx, cy]]; radius is normalized against min(w, h).
      if (points.length < 1) return null;
      const [cx, cy] = points[0];
      const rPx = (shape.radius ?? 0) * Math.min(w, h);
      return [cx * w - rPx, cy * h - rPx];
    }

    case IMAGE_POLYGON:
    case IMAGE_LINE: {
      if (points.length < 2) return null;
      return minCornerPx(points, w, h);
    }

    // IMAGE_MASK and anything unrecognised are not labelled.
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
