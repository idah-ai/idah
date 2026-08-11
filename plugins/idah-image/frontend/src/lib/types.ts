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

// ─── Image annotation shape ──────────────────────────────────────────────

/**
 * Image-specific annotation shape args — simple geometry without frame/keyframe
 * wrapping (frames are only relevant to video). The shape `type` is stored
 * separately on the record as `shape_type`.
 */
export interface IImageAnnotationShape {
  points: [number, number][];
  /** Allow extensibility. */
  [key: string]: unknown;
}

// ─── Image annotation value ──────────────────────────────────────────────

/**
 * Image annotation value payload (maps to DB `category` + `properties` columns).
 */
export interface IImageAnnotationValue extends IAnnotationValue {
  /** Category path, e.g. "vehicles/car". */
  category?: string;
  /** Arbitrary properties for the annotation. */
  properties?: Record<string, unknown>;
}

// ─── Image annotation record ─────────────────────────────────────────────

/**
 * Image annotation record with transient UI state fields.
 */
export interface IImageAnnotationRecord extends IAnnotationRecord<IImageAnnotationShape, IImageAnnotationValue> {
  synced?: boolean;
}
