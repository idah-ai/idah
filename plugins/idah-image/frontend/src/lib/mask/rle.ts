// ---------------------------------------------------------------------------
// RLE codec for binary mask tiles
//
// Format: implicit alternating runs starting with a 0-run, last run omitted.
// Each run length is encoded as 1 byte (0–127) or 2 bytes (128–32767) with
// bit 7 of the first byte as the size flag. The byte sequence is then
// base64-encoded (RFC 4648 with padding).
//
// Example: 5 zeros, 3 ones, rest zeros → encode runs [5, 3] → bytes
// [0x05, 0x03] → base64 "BQM=".
// ---------------------------------------------------------------------------

import { MASK_TILE_SIZE } from "./constants";

/**
 * Encode a binary Uint8Array (values 0 or 1) into an RLE string.
 *
 * The encoding is canonical: the last run (which can be inferred from the
 * total pixel count) is always omitted, and runs always start with a 0-run.
 */
export function encode(buffer: Uint8Array, w: number, h: number): string {
  const total = w * h;
  if (total === 0) return "";

  // ── Run-length pass ──────────────────────────────────────────────────
  // Always start with a 0-run (even if length 0). Runs alternate implicitly.
  const runs: number[] = [];
  let currentBit = 0;
  let count = 0;

  for (let i = 0; i < total; i++) {
    const v = buffer[i];
    if (v === currentBit) {
      count++;
    } else {
      runs.push(count);
      currentBit = currentBit === 0 ? 1 : 0;
      count = 1;
    }
  }
  runs.push(count); // push the last run

  // The last run is always omitted (canonical encoding)
  runs.pop();

  // ── Byte-packing pass ────────────────────────────────────────────────
  const bytes = packRunLengths(runs);

  // ── Base64 encode ────────────────────────────────────────────────────
  if (bytes.length === 0) return "";
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode an RLE string back into a binary Uint8Array.
 */
export function decode(rle: string, w: number, h: number): Uint8Array {
  const total = w * h;
  if (total === 0) return new Uint8Array(0);
  if (rle === "") return new Uint8Array(total); // all zeros

  // ── Base64 decode ────────────────────────────────────────────────────
  const binary = atob(rle);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // ── Unpack run lengths ───────────────────────────────────────────────
  const explicitRuns = unpackRunLengths(bytes);
  const sumExplicit = explicitRuns.reduce((a, b) => a + b, 0);
  const implicitLen = total - sumExplicit;

  if (implicitLen < 0) {
    throw new Error(
      `RLE data exceeds tile size: sum of explicit runs (${sumExplicit}) > total pixels (${total})`,
    );
  }

  // ── Reconstruct buffer ───────────────────────────────────────────────
  const buffer = new Uint8Array(total);
  let offset = 0;
  let bit = 0; // runs start with a 0-run

  for (const run of explicitRuns) {
    if (bit === 1) {
      buffer.fill(1, offset, offset + run);
    }
    // bit === 0: buffer is already zero-initialized, no-op
    offset += run;
    bit = 1 - bit;
  }

  // Implicit last run
  if (bit === 1 && implicitLen > 0) {
    buffer.fill(1, offset, offset + implicitLen);
  }

  return buffer;
}

// ── Internal helpers ─────────────────────────────────────────────────────

/**
 * Pack run lengths into a byte array per the 1-or-2-byte encoding:
 * - 0–127      → 1 byte (bit 7 clear)
 * - 128–32767  → 2 bytes (bit 7 of first byte set, big-endian 15 bits)
 * - > 32767    → throws (defensive guard)
 */
export function packRunLengths(runs: number[]): Uint8Array {
  const bytes: number[] = [];

  for (const run of runs) {
    if (run > 32767) {
      throw new Error(
        `Run length ${run} exceeds maximum representable value 32767`,
      );
    }
    if (run < 128) {
      bytes.push(run & 0x7f);
    } else {
      bytes.push(0x80 | ((run >> 8) & 0x7f));
      bytes.push(run & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Unpack run lengths from a byte array per the 1-or-2-byte encoding.
 */
export function unpackRunLengths(bytes: Uint8Array): number[] {
  const runs: number[] = [];
  let i = 0;

  while (i < bytes.length) {
    const b0 = bytes[i];
    if (b0 & 0x80) {
      // 2-byte value
      if (i + 1 >= bytes.length) {
        throw new Error("Truncated RLE data: expected 2nd byte of 2-byte value");
      }
      const value = ((b0 & 0x7f) << 8) | bytes[i + 1];
      runs.push(value);
      i += 2;
    } else {
      // 1-byte value
      runs.push(b0);
      i += 1;
    }
  }

  return runs;
}