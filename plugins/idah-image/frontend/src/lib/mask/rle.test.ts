// ---------------------------------------------------------------------------
// RLE codec tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { encode, decode, packRunLengths } from "./rle";
import { MASK_TILE_SIZE } from "./constants";
import { readFileSync } from "fs";
import { join } from "path";

const FIXTRE_DIR = join(__dirname, "../../../../fixtures/rle");

describe("RLE codec — round-trip", () => {
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

  it("round-trips a single painted pixel at offset 0", () => {
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    buf[0] = 1;
    const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded).toEqual(buf);
  });

  it("round-trips a single painted pixel at the last offset", () => {
    const last = MASK_TILE_SIZE * MASK_TILE_SIZE - 1;
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    buf[last] = 1;
    const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded).toEqual(buf);
  });

  it("round-trips a single painted pixel at a middle offset", () => {
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    buf[100] = 1;
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
});

describe("RLE codec — format assertions", () => {
  it("encodes a fully-empty tile to empty string", () => {
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    expect(encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE)).toBe("");
  });

  it("encodes a fully-filled tile to a single byte (value 0)", () => {
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE).fill(1);
    const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
    const decodedBytes = atob(rle);
    expect(decodedBytes.length).toBe(1);
    expect(decodedBytes.charCodeAt(0)).toBe(0);
  });

  it("empty string decodes to all-zero buffer", () => {
    const decoded = decode("", MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded.every((v) => v === 0)).toBe(true);
    expect(decoded.length).toBe(MASK_TILE_SIZE * MASK_TILE_SIZE);
  });

  it("encodes an empty border tile to empty string", () => {
    const buf = new Uint8Array(32 * 32);
    expect(encode(buf, 32, 32)).toBe("");
  });
});

describe("RLE codec — byte-packing boundary", () => {
  it("run length 127 encodes to 1 byte", () => {
    const runs = [127];
    const packed = packRunLengths(runs);
    expect(packed.length).toBe(1);
    expect(packed[0]).toBe(0x7f);
  });

  it("run length 128 encodes to 2 bytes with high bit set", () => {
    const runs = [128];
    const packed = packRunLengths(runs);
    expect(packed.length).toBe(2);
    expect(packed[0] & 0x80).toBe(0x80); // high bit set
    // 128 = 0x0080 → big-endian 15-bit: byte0 = 0x80 | (0>>7) = 0x80, byte1 = 0x80
    expect(packed[0]).toBe(0x80);
    expect(packed[1]).toBe(0x80);
  });

  it("round-trips a tile with a run of exactly 127", () => {
    // 127 zeros, then 1 one at offset 127, rest zeros
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    buf[127] = 1;
    const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded).toEqual(buf);
  });

  it("round-trips a tile with a run of exactly 128", () => {
    // 128 zeros, then 1 one at offset 128, rest zeros
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    buf[128] = 1;
    const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded).toEqual(buf);
  });
});

describe("RLE codec — fixture decode", () => {
  it("decodes the empty fixture correctly", () => {
    const fixturePath = join(FIXTRE_DIR, "empty.txt");
    const rle = readFileSync(fixturePath, "utf-8").trim();
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded.length).toBe(MASK_TILE_SIZE * MASK_TILE_SIZE);
    expect(decoded.every((v) => v === 0)).toBe(true);
  });

  it("decodes the full fixture correctly", () => {
    const fixturePath = join(FIXTRE_DIR, "full.txt");
    const rle = readFileSync(fixturePath, "utf-8").trim();
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded.length).toBe(MASK_TILE_SIZE * MASK_TILE_SIZE);
    expect(decoded.every((v) => v === 1)).toBe(true);
  });

  it("decodes the single-pixel fixture correctly", () => {
    const fixturePath = join(FIXTRE_DIR, "single-pixel.txt");
    const rle = readFileSync(fixturePath, "utf-8").trim();
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded.length).toBe(MASK_TILE_SIZE * MASK_TILE_SIZE);
    expect(decoded[0]).toBe(1);
    expect(decoded.subarray(1).every((v) => v === 0)).toBe(true);
  });

  it("decodes the border-32x32 fixture correctly", () => {
    const fixturePath = join(FIXTRE_DIR, "border-32x32.txt");
    const rle = readFileSync(fixturePath, "utf-8").trim();
    const decoded = decode(rle, 32, 32);
    expect(decoded.length).toBe(32 * 32);
    expect(decoded.every((v) => v === 0)).toBe(true);
  });

  it("decodes the run-127 fixture correctly", () => {
    const fixturePath = join(FIXTRE_DIR, "run-127.txt");
    const rle = readFileSync(fixturePath, "utf-8").trim();
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded.length).toBe(MASK_TILE_SIZE * MASK_TILE_SIZE);
    expect(decoded.subarray(0, 127).every((v) => v === 0)).toBe(true);
    expect(decoded[127]).toBe(1);
    expect(decoded.subarray(128).every((v) => v === 0)).toBe(true);
  });

  it("decodes the run-128 fixture correctly", () => {
    const fixturePath = join(FIXTRE_DIR, "run-128.txt");
    const rle = readFileSync(fixturePath, "utf-8").trim();
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded.length).toBe(MASK_TILE_SIZE * MASK_TILE_SIZE);
    expect(decoded.subarray(0, 128).every((v) => v === 0)).toBe(true);
    expect(decoded[128]).toBe(1);
    expect(decoded.subarray(129).every((v) => v === 0)).toBe(true);
  });
});

describe("RLE codec — randomized round-trip", () => {
  // Fixed seed for reproducibility
  function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  it("round-trips a sparse tile (~5% paint)", () => {
    const rng = seededRandom(42);
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = rng() < 0.05 ? 1 : 0;
    }
    const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded).toEqual(buf);
  });

  it("round-trips a dense tile (~90% paint)", () => {
    const rng = seededRandom(123);
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = rng() < 0.9 ? 1 : 0;
    }
    const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded).toEqual(buf);
  });

  it("round-trips a ~50/50 tile", () => {
    const rng = seededRandom(77);
    const buf = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = rng() < 0.5 ? 1 : 0;
    }
    const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
    const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
    expect(decoded).toEqual(buf);
  });
});

describe("RLE codec — defensive guard", () => {
  it("packRunLengths throws for values > 32767", () => {
    expect(() => packRunLengths([32768])).toThrow("exceeds maximum");
    expect(() => packRunLengths([99999])).toThrow("exceeds maximum");
    expect(() => packRunLengths([32767])).not.toThrow(); // boundary
  });
});

describe("RLE codec — canonical encoding", () => {
  it("re-encoding decoded output produces identical string", () => {
    const scenarios = [
      { label: "empty", buf: new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE) },
      { label: "full", buf: new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE).fill(1) },
      { label: "single-pixel", buf: () => { const b = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE); b[0] = 1; return b; } },
      { label: "checkerboard", buf: () => {
        const b = new Uint8Array(MASK_TILE_SIZE * MASK_TILE_SIZE);
        for (let i = 0; i < b.length; i++) b[i] = i % 2 === 0 ? 1 : 0;
        return b;
      }},
    ];

    for (const s of scenarios) {
      const buf = typeof s.buf === "function" ? s.buf() : s.buf;
      const rle = encode(buf, MASK_TILE_SIZE, MASK_TILE_SIZE);
      const decoded = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);
      const rle2 = encode(decoded, MASK_TILE_SIZE, MASK_TILE_SIZE);
      expect(rle2).toBe(rle); // deterministic
    }
  });
});
