// ---------------------------------------------------------------------------
// string.test.ts — generateHash, with and without Web Crypto; truncatePath
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";
import { generateHash, truncatePath } from "./string";

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

describe("truncatePath", () => {
  const long =
    "SET1_07-10-2024/PASEO_XLR/ESSAIS_DRONE_DEAUVILLE_AOUT_2024/data/PASEO_XLR/Capture/Capture0000.mov/IMG_001010.jpg";

  it("leaves a name that fits untouched", () => {
    expect(truncatePath("cam_a/0001.jpg", 20)).toBe("cam_a/0001.jpg");
    expect(truncatePath("0001.jpg", 8)).toBe("0001.jpg");
  });

  it("keeps the top folder and the file, and drops folders from the middle", () => {
    expect(truncatePath(long, 50)).toBe("SET1_07-10-2024/…/Capture0000.mov/IMG_001010.jpg");
  });

  it("keeps as many of the closest parent folders as fit", () => {
    expect(truncatePath(long, 58)).toBe("SET1_07-10-2024/…/Capture/Capture0000.mov/IMG_001010.jpg");
    expect(truncatePath(long, 40)).toBe("SET1_07-10-2024/…/IMG_001010.jpg");
  });

  it("drops the top folder when it does not fit next to the file", () => {
    expect(truncatePath(long, 30)).toBe("…/IMG_001010.jpg");
    expect(truncatePath("a_very_long_top_folder_name/2024/clip/0001.jpg", 20)).toBe("…/2024/clip/0001.jpg");
    expect(truncatePath("a_very_long_top_folder_name/2024/clip/0001.jpg", 19)).toBe("…/clip/0001.jpg");
  });

  it("keeps the end of a file name too long on its own", () => {
    expect(truncatePath("a/very_long_file_name_0001.jpg", 12)).toBe("…me_0001.jpg");
  });

  it("keeps the end of a name that is not a path", () => {
    expect(truncatePath("a_very_long_entry_name_0001.jpg", 12)).toBe("…me_0001.jpg");
  });

  it("never returns more than the limit", () => {
    for (let max = 5; max <= long.length; max++) expect(truncatePath(long, max).length).toBeLessThanOrEqual(max);
  });
});
