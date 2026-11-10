// ---------------------------------------------------------------------------
// string.test.ts — generateHash, with and without Web Crypto
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";
import { generateHash } from "./string";

describe("generateHash", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hashes with SHA-256 where Web Crypto is available", async () => {
    // The published SHA-256 of "abc".
    expect(await generateHash("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("falls back where Web Crypto is missing, as on a plain-HTTP origin", async () => {
    vi.stubGlobal("crypto", {});

    const hash = await generateHash("abc");

    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(hash).toBe(await generateHash("abc"));
    expect(hash).not.toBe(await generateHash("abd"));
  });
});
