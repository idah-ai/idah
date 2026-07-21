// ---------------------------------------------------------------------------
// RLE codec for binary mask tiles
//
// Format: comma-separated pairs of (value, count), e.g. "0,5,1,3,0,2"
// means 5 zeros, 3 ones, 2 zeros.
// ---------------------------------------------------------------------------

import { MASK_TILE_SIZE } from "./constants";

/**
 * Encode a binary Uint8Array (values 0 or 1) into an RLE string.
 */
export function encode(buffer: Uint8Array, w: number, h: number): string {
  const runs: number[] = [];
  let current = buffer[0];
  let count = 0;

  for (let i = 0; i < w * h; i++) {
    const v = buffer[i];
    if (v === current) {
      count++;
    } else {
      runs.push(current, count);
      current = v;
      count = 1;
    }
  }
  runs.push(current, count);

  return runs.join(",");
}

/**
 * Decode an RLE string back into a binary Uint8Array.
 */
export function decode(rle: string, w: number, h: number): Uint8Array {
  const parts = rle.split(",").map(Number);
  const buffer = new Uint8Array(w * h);
  let offset = 0;

  for (let i = 0; i < parts.length; i += 2) {
    const value = parts[i];
    const count = parts[i + 1];
    buffer.fill(value, offset, offset + count);
    offset += count;
  }

  return buffer;
}
