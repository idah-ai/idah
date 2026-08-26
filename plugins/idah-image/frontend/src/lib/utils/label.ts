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
import { centroid, type Point } from "$lib/utils/math/point";
import { polygonVisualCenter } from "$lib/utils/math/polylabel";

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
 * Centre point of the annotation, in media pixels. The label is rendered
 * horizontally centred and just below this point.
 *
 * The centre is rotation-invariant for every shape here — a box/ellipse rotates
 * about its own centre — so, unlike the old corner anchor, no explicit rotation
 * is needed. A polygon uses its visual centre (pole of inaccessibility) rather
 * than the vertex average, so the label sits inside even concave shapes.
 *
 * Returns null for masks (drawn to canvas, excluded from labelling) and for any
 * shape whose points are missing or malformed.
 */
export function labelCenterPx(annotation: LabelAnnotation, w: number, h: number): Point | null {
  const shape = annotation?.shape;
  const points = (shape?.points ?? []) as Point[];

  switch (shape?.type) {
    case IMAGE_BOUNDING_BOX: {
      // Stored as 4 unrotated AABB corners plus a separate `angle`. Rotation is
      // about the centroid, so the box centre is the corner centroid either way.
      if (points.length < 4) return null;
      return centroid(points.map(([x, y]): Point => [x * w, y * h]));
    }

    case IMAGE_ELLIPSE: {
      // Stored as [[cx, cy], [rx, ry]] + angle — centroid and radii. The centre
      // is (cx, cy); a rotation of the ellipse leaves it unchanged.
      if (points.length < 2) return null;
      const [cx, cy] = points[0];
      return [cx * w, cy * h];
    }

    case IMAGE_CIRCLE: {
      // points = [[cx, cy]]; the centre is the point itself.
      if (points.length < 1) return null;
      const [cx, cy] = points[0];
      return [cx * w, cy * h];
    }

    case IMAGE_POLYGON: {
      if (points.length < 2) return null;
      return polygonVisualCenter(points.map(([x, y]): Point => [x * w, y * h]));
    }

    case IMAGE_LINE: {
      // A line has no interior; its centre is the midpoint of the endpoints.
      if (points.length < 2) return null;
      return centroid(points.map(([x, y]): Point => [x * w, y * h]));
    }

    // IMAGE_MASK and anything unrecognised are not labelled.
    default:
      return null;
  }
}
