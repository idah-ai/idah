// ---------------------------------------------------------------------------
// rasterize-tile.ts — Turn one binary mask tile into an ImageBitmap
//
// Writes the painted pixels into an ImageData in a single pass and uploads it
// with putImageData, instead of one fillRect call per pixel. The result is
// composited onto the main canvas with a single drawImage per tile.
// ---------------------------------------------------------------------------

import { MASK_TILE_SIZE } from "./constants";

/**
 * Rasterize a MASK_TILE_SIZE × MASK_TILE_SIZE binary buffer (values 0/1) into
 * an ImageBitmap where painted pixels use `color` ([r, g, b, a], a in 0–255)
 * and unpainted pixels are fully transparent.
 */
export function rasterizeTile(buffer: Uint8Array, color: [number, number, number, number]): ImageBitmap {
  const [r, g, b, a] = color;
  const imageData = new ImageData(MASK_TILE_SIZE, MASK_TILE_SIZE);
  const pixels = imageData.data;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] !== 0) {
      const p = i * 4;
      pixels[p] = r;
      pixels[p + 1] = g;
      pixels[p + 2] = b;
      pixels[p + 3] = a;
    }
  }
  const offscreen = new OffscreenCanvas(MASK_TILE_SIZE, MASK_TILE_SIZE);
  offscreen.getContext("2d")!.putImageData(imageData, 0, 0);
  return offscreen.transferToImageBitmap();
}
