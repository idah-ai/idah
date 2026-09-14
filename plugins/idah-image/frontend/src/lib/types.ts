// ---------------------------------------------------------------------------
// Plugin-specific Image annotation types
//
// These types extend the generic annotation record model for the image
// modality. They are used by the idah-image plugin and any other plugin
// dealing with image annotation.
// ---------------------------------------------------------------------------

import type { IAnnotationMetadata, IAnnotationRecord, IAnnotationValue } from "$idah/v2/types";

// ─── Shape constants ─────────────────────────────────────────────────────

export const DEFAULT_MODE = "editor";
export const REVIEW_MODE = "review";
export const NOTE_MODE = "note";
export const IMAGE_BOUNDING_BOX = "idah-image:bounding-box";
export const IMAGE_POLYGON = "idah-image:polygon";
export const IMAGE_LINE = "idah-image:line";
export const IMAGE_CIRCLE = "idah-image:circle";
export const IMAGE_ELLIPSE = "idah-image:ellipse";
export const IMAGE_MASK = "idah-image:mask";

/**
 * Special, non-drawable shape type holding entry-level (whole image)
 * category + properties. Not namespaced under a modality.
 */
export const ENTRY_ROOT = "entry:root";

/**
 * Shape types that are never rendered as drawable geometry and must be
 * excluded from the left-sidebar tool list, the on-canvas layer, and the
 * generic annotation list.
 */
export const NON_DRAWABLE_SHAPE_TYPES = new Set<string>([ENTRY_ROOT]);

// ─── Image annotation shape ──────────────────────────────────────────────

/**
 * Image-specific annotation shape — simple geometry without frame/keyframe
 * wrapping (frames are only relevant to video).
 */
export interface IImageAnnotationShape {
  type: string;
  points: [number, number][];
  /** Allow extensibility. */
  [key: string]: unknown;
}

// ─── Image annotation value ──────────────────────────────────────────────

/**
 * Image annotation value payload (maps to DB `annotation` JSONB column).
 */
export interface IImageAnnotationValue extends IAnnotationValue {
  /** Category path, e.g. "vehicles/car". */
  category?: string;
  /** Human-readable label, e.g. "car", "bus". */
  label?: string;
  /** Arbitrary attributes for the annotation's properties. */
  attributes?: Record<string, unknown>;
}

// ─── Image annotation record ─────────────────────────────────────────────

/**
 * Image annotation record with transient UI state fields.
 */
export interface IImageAnnotationRecord extends IAnnotationRecord<IImageAnnotationShape, IImageAnnotationValue> {
  synced?: boolean;
}
