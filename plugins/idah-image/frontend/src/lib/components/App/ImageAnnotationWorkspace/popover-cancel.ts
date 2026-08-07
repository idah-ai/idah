// ---------------------------------------------------------------------------
// popover-cancel.ts — Popover cancel handler for annotation creation
//
// Extracted from ImageAnnotationWorkspace.svelte so it can be imported and
// tested directly without a Svelte component render.  The inline handlers
// in the template call this function with the real reactive state setters.
// ---------------------------------------------------------------------------

import { IMAGE_MASK, IMAGE_POLYGON, IMAGE_LINE } from "$lib/types";
import type { Point } from "$lib/utils/math/point";
import { maskSession } from "$lib/state/mask-session.svelte";
import { maskPolygonDraft } from "$lib/commands/mode/mask_polygon";
import { maskTool } from "$lib/state/mask-tool.svelte";
import { draft as polygonDraft } from "$lib/commands/annotation/polygon.add_point.svelte";
import { lineDraft } from "$lib/commands/annotation/line.add_point.svelte";
import { viewport } from "$lib/state/viewport.svelte";

export type AnnotationValue = Record<string, unknown> & { category?: string; attributes?: Record<string, unknown> };

export interface PopoverCancelContext {
  setAnnotationValue: (v: AnnotationValue) => void;
  setPendingValue: (v: AnnotationValue) => void;
  clearShapeSelectionArgs: () => void;
  setShowPopOver: (v: boolean) => void;
  selectAnnotation: () => void;
}

/**
 * Handle popover cancel for all shape types.
 *
 * Extracted as a plain function so it can be imported and tested directly.
 * The inline handlers in the template's `onOpenChange` and Cancel button
 * call this function with the real reactive state setters.
 *
 * **IMPORTANT**: For `IMAGE_MASK`, this function calls `maskSession.reset()`
 * to discard the in-progress paint session.  Without this call, a cancelled
 * new-mask attempt would leak its pixel buffers into the next unrelated
 * new-mask attempt (since both have `annotationId === undefined` and the
 * `continuePending` flag in `beginSession` is always `true` for this case).
 * Every abandonment path must call `maskSession.reset()` — this is the
 * primary defense against buffer bleeding, not `beginSession`'s own logic.
 */
export function handlePopoverCancel(
  args: [type: string, points: Point[], extraProps?: Record<string, unknown>] | undefined,
  ctx: PopoverCancelContext,
): void {
  ctx.setAnnotationValue({});
  ctx.setPendingValue({});
  ctx.clearShapeSelectionArgs();
  if (args) {
    const [type, points] = args;
    if (type === IMAGE_POLYGON) {
      polygonDraft.points = points;
      viewport.mode = IMAGE_POLYGON;
    } else if (type === IMAGE_LINE) {
      lineDraft.points = points;
      viewport.mode = IMAGE_LINE;
    } else if (type === IMAGE_MASK) {
      maskSession.reset();
      if (maskPolygonDraft.closedPoints) {
        maskPolygonDraft.points = maskPolygonDraft.closedPoints;
        maskPolygonDraft.closedPoints = null;
        maskTool.active = "polygon";
      }
      viewport.mode = IMAGE_MASK;
    }
  }
  ctx.selectAnnotation();
}