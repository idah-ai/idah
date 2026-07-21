// ---------------------------------------------------------------------------
// RLE codec tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { encode, decode } from "./rle";
import { MASK_TILE_SIZE } from "./constants";
import { readFileSync } from "fs";
import { join } from "path";

const FIXTURE_DIR = join(__dirname, "../../../../fixtures/rle");

describe("RLE codec", () => {
  it("round-trips a fully-empty tile", () => {
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded).toEqual(buf);
  });

  it("round-trips a fully-filled tile", () => {
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE).fill(1);
    const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded).toEqual(buf);
  });

  it("round-trips a single painted pixel", () => {
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    buf[0] = 1;
    const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded).toEqual(buf);
  });

  it("round-trips a border tile (smaller than tile_size)", () => {
    const w = 32;
    const h = 32;
    const buf = new Uint8Array(w * h);
    buf[0] = 1;
    buf[w * h - 1] = 1;
    const rle = encode(buf, w, h);
    const decoded = decode(rle, w, h);
    expect(decoded).toEqual(buf);
  });

  it("round-trips a checkerboard pattern", () => {
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = i % 2 === 0 ? 1 : 0;
    }
    const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded).toEqual(buf);
  });

  it("decodes the empty fixture correctly", () => {
    const fixturePath = join(FIXTURE_DIR, "empty.txt");
    const rle = readFileSync(fixturePath, "utf-8").trim();
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded.every((v) => v === 0)).toBe(true);
  });

  it("decodes the full fixture correctly", () => {
    const fixturePath = join(FIXTURE_DIR, "full.txt");
    const rle = readFileSync(fixturePath, "utf-8").trim();
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded.every((v) => v === 1)).toBe(true);
  });

  it("decodes the single-pixel fixture correctly", () => {
    const fixturePath = join(FIXTURE_DIR, "single-pixel.txt");
    const rle = readFileSync(fixturePath, "utf-8").trim();
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded[0]).toBe(1);
    expect(decoded.subarray(1).every((v) => v === 0)).toBe(true);
  });

  it("decodes the border-32x32 fixture correctly", () => {
    const fixturePath = join(FIXTURE_DIR, "border-32x32.txt");
    const rle = readFileSync(fixturePath, "utf-8").trim();
    const decoded = decode(rle, 32, 32);
    expect(decoded.every((v) => v === 0)).toBe(true);
  });

  it("encodes a fully-empty tile to '0,4096'", () => {
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    expect(encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE)).toBe("0,4096");
  });
});
