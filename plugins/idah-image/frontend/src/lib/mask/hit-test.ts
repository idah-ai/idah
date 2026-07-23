// ---------------------------------------------------------------------------
// hit-test.ts — Mask canvas layer hit-testing
//
// The one canonical implementation of hit-testing mask annotations on the
// canvas layer. Used by both ShapesContainer.svelte (click/hover) and
// any other consumer that needs to determine if a pixel belongs to a mask.
//
// Tile buffers are sourced from the shared decode cache (tile-cache.ts)
// rather than decoding RLE inline, so decoding a given tile's RLE happens
// once per value change, not once per frame/hover-event/click.
// ---------------------------------------------------------------------------

import { MASK_TILE_SIZE, MASK_LAYER_Z_ORDER, type MaskLayerZOrder } from "$lib/mask/constants";
import { IMAGE_MASK } from "$lib/types";
import { getOrCreate } from "$lib/mask/tile-cache";

/**
 * Check if a mask tile has a painted pixel at the given image-pixel position.
 *
 * @param buffer Decoded Uint8Array for the tile
 * @param tileCol Tile column index
 * @param tileRow Tile row index
 * @param imgX Image-pixel X coordinate
 * @param imgY Image-pixel Y coordinate
 * @returns true if the pixel is painted (value === 1)
 */
export function isMaskPixelPainted(
  buffer: Uint8Array,
  tileCol: number,
  tileRow: number,
  imgX: number,
  imgY: number,
): boolean {
  const localX = Math.floor(imgX) - tileCol * MASK_TILE_SIZE;
  const localY = Math.floor(imgY) - tileRow * MASK_TILE_SIZE;

  if (localX < 0 || localX >= MASK_TILE_SIZE || localY < 0 || localY >= MASK_TILE_SIZE) {
    return false;
  }

  const idx = localY * MASK_TILE_SIZE + localX;
  return buffer[idx] === 1;
}

/**
 * Result of a hit-test across the mask layer.
 */
export interface HitTestMaskResult {
  /** The annotation ID that was hit, if any. */
  annotationId: string | null;
  /** The annotation record that was hit, if any. */
  annotation: unknown | null;
}

/**
 * Hit-test the mask canvas layer at the given image-pixel coordinates.
 *
 * First checks which tile the pixel falls into, then checks if that tile
 * has a painted pixel at that exact position. Sources tile buffers from
 * the shared decode cache rather than decoding RLE inline.
 *
 * @param imgX Image-pixel X coordinate
 * @param imgY Image-pixel Y coordinate
 * @param maskAnnotations Array of mask annotation records (must have shape data)
 * @param isHiddenFn Function to check if an annotation is hidden
 * @param resolveColorFn Function to resolve the color for a given annotation
 * @returns HitTestMaskResult with the winning annotation ID/record, or null
 */
export function hitTestMaskLayer(
  imgX: number,
  imgY: number,
  maskAnnotations: Array<{
    id: string;
    shape: Record<string, unknown>;
    value?: Record<string, unknown>;
  }>,
  isHiddenFn: (ann: { id: string }) => boolean,
  resolveColorFn: (ann: { id: string; value?: Record<string, unknown> }) => [number, number, number, number],
): { annotationId: string | null; annotation: unknown | null } {
  const col = Math.floor(imgX / MASK_TILE_SIZE);
  const row = Math.floor(imgY / MASK_TILE_SIZE);
  const tileKey = `${col}:${row}`;

  for (const ann of maskAnnotations) {
    // Skip hidden annotations — hidden masks should not be selectable
    if (isHiddenFn(ann)) continue;

    const shape = ann.shape;
    if (shape?.type !== IMAGE_MASK) continue;

    const shapeTileKey = `tile-${col}x${row}`;
    const tileData = shape[shapeTileKey] as { rle?: string } | undefined;
    if (!tileData?.rle) continue;

    // Get the buffer from the shared cache (or decode on first access)
    const color = resolveColorFn(ann);
    const { buffer } = getOrCreate(ann.id, tileKey, tileData.rle, color);

    if (isMaskPixelPainted(buffer, col, row, imgX, imgY)) {
      return { annotationId: ann.id, annotation: ann };
    }
  }

  return { annotationId: null, annotation: null };
}

// ── Z-order resolver ───────────────────────────────────────────────────────

/**
 * Result of a combined hit-test across both mask canvas and SVG shape layers.
 */
export interface HitTestResult {
  annotationId: string | null;
  annotation: unknown | null;
}

/**
 * Resolve which layer wins at a given pixel, based on the shared z-order config.
 *
 * When `MASK_LAYER_Z_ORDER` is "below-svg" (default):
 *   1. Check SVG shapes first (via the provided SVG hit-test callback).
 *   2. If no SVG shape was hit, check the mask canvas layer.
 *
 * When `MASK_LAYER_Z_ORDER` is "above-svg":
 *   1. Check the mask canvas layer first.
 *   2. If no mask tile was hit, check SVG shapes.
 *
 * @param imgX Image-pixel X coordinate
 * @param imgY Image-pixel Y coordinate
 * @param maskAnnotations Array of mask annotation records
 * @param isHiddenFn Function to check if an annotation is hidden
 * @param resolveColorFn Function to resolve the color for a given annotation
 * @param svgHitTestFn Callback that returns the first SVG annotation hit at (imgX, imgY),
 *        or null if nothing was hit. Only called when the z-order requires it.
 * @returns The winning annotation, or null if nothing was hit.
 */
export function resolveHitTest(
  imgX: number,
  imgY: number,
  maskAnnotations: Array<{
    id: string;
    shape: Record<string, unknown>;
    value?: Record<string, unknown>;
  }>,
  isHiddenFn: (ann: { id: string }) => boolean,
  resolveColorFn: (ann: { id: string; value?: Record<string, unknown> }) => [number, number, number, number],
  svgHitTestFn: () => { annotationId: string | null; annotation: unknown | null },
  zOrder: MaskLayerZOrder = MASK_LAYER_Z_ORDER,
): HitTestResult {
  if (zOrder === "above-svg") {
    // Mask on top: check mask first, fall through to SVG
    const maskHit = hitTestMaskLayer(imgX, imgY, maskAnnotations, isHiddenFn, resolveColorFn);
    if (maskHit.annotationId) return maskHit;
    return svgHitTestFn();
  } else {
    // SVG on top (default): check SVG first, fall through to mask
    const svgHit = svgHitTestFn();
    if (svgHit.annotationId) return svgHit;
    return hitTestMaskLayer(imgX, imgY, maskAnnotations, isHiddenFn, resolveColorFn);
  }
}
