// ---------------------------------------------------------------------------
// Plugin-specific Image annotation types
//
// These types extend the generic annotation record model for the image
// modality. They are used by the idah-image plugin and any other plugin
// dealing with image annotation.
// ---------------------------------------------------------------------------

import type { IAnnotationMetadata, IAnnotationRecord, IAnnotationValue } from "$idah/v2/types";

// ─── Frame range ─────────────────────────────────────────────────────────

/**
 * Frame range for an annotation (used by filter system for image/timeline).
 */
export interface IAnnotationFrame {
  start: number;
  end: number;
}

// ─── Keyframe selection ──────────────────────────────────────────────────

/**
 * A single keyframe selection within an annotation's shape.
 */
export interface IImageFrameSelection {
  frame: number;
  /** Rotation angle in radians (optional). */
  angle: number;
  /** Polygon points for the frame selection. */
  points: [number, number][];
}

// ─── Shape constants ─────────────────────────────────────────────────────

export const IMAGE_BOUNDING_BOX = "idah-image:bounding-box";
export const IMAGE_POLYGON = "idah-image:polygon";

// ─── Image annotation shape ──────────────────────────────────────────────

/**
 * Image-specific annotation shape — always has a frame range and keyframes.
 */
export interface IImageAnnotationShape {
  type: string;
  start: number;
  end: number;
  /** Keyframe selections. */
  frames: IImageFrameSelection[];
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

// ─── Image annotation metadata helper ────────────────────────────────────

/**
 * Extract the group identifier from an annotation record's metadata.
 *
 * The group is stored at `metadata.group_id`.
 * When absent, falls back to the annotation's own id (making each annotation
 * its own group).
 */
export function getAnnotationGroupId(ann: { id?: string; metadata?: IAnnotationMetadata }): string {
  return ann.metadata?.group_id ?? ann.id ?? "";
}
