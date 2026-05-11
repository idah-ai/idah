// ---------------------------------------------------------------------------
// Plugin-specific video annotation types
//
// These types extend the generic annotation record model for the video
// modality. They are used by the idah-video plugin and any other plugin
// dealing with video annotation.
// ---------------------------------------------------------------------------

import type {
  IAnnotationRecord,
  IAnnotationMetadata,
  IAnnotationValue,
} from "$idah/v2/types";

// ─── Frame range ─────────────────────────────────────────────────────────

/**
 * Frame range for an annotation (used by filter system for video/timeline).
 */
export interface IAnnotationFrame {
  start: number;
  end: number;
}

// ─── Keyframe selection ──────────────────────────────────────────────────

/**
 * A single keyframe selection within an annotation's shape.
 */
export interface IVideoFrameSelection {
  frame: number;
  /** Rotation angle in radians (optional). */
  angle: number;
  /** Polygon points for the frame selection. */
  points: [number, number][];
}

// ─── Shape constants ─────────────────────────────────────────────────────

export const VIDEO_BOUNDING_BOX = "idah-video:bounding-box";
export const VIDEO_POLYGON = "idah-video:polygon";

// ─── Video annotation shape ──────────────────────────────────────────────

/**
 * Video-specific annotation shape — always has a frame range and keyframes.
 */
export interface IVideoAnnotationShape {
  type: string;
  start: number;
  end: number;
  /** Keyframe selections. */
  frames: IVideoFrameSelection[];
  /** Allow extensibility. */
  [key: string]: unknown;
}

// ─── Video annotation value ──────────────────────────────────────────────

/**
 * Video annotation value payload (maps to DB `annotation` JSONB column).
 */
export interface IVideoAnnotationValue extends IAnnotationValue {
  /** Category path, e.g. "vehicles/car". */
  category?: string;
  /** Human-readable label, e.g. "car", "bus". */
  label?: string;
  /** Arbitrary attributes for the annotation's properties. */
  attributes?: Record<string, unknown>;
}

// ─── Video annotation record ─────────────────────────────────────────────

/**
 * Video annotation record with transient UI state fields.
 */
export interface IVideoAnnotationRecord extends IAnnotationRecord<
  IVideoAnnotationShape,
  IVideoAnnotationValue
> {
  locked?: boolean;
  hidden?: boolean;
  synced?: boolean;
}

// ─── Video annotation metadata helper ────────────────────────────────────

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
