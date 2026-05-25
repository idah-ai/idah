// ---------------------------------------------------------------------------
// media.test.ts — Unit tests for media state
// ---------------------------------------------------------------------------
import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockMedia = vi.hoisted(() => ({
  id: "mock-entry-001",
  resource: "mock-entry-001",
  key: "",
  mime_type: "image/jpeg",
  filename: "test.jpg",
  url: "/medias/master.jpg",
  meta: { duration: 60, fps: 30, width: 1920, height: 1080 },
}));

vi.mock("./driver.svelte", () => ({
  getDriver: vi.fn(() => ({
    get media() {
      return { ...mockMedia };
    },
  })),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { getDriver } from "./driver.svelte";
import { media } from "./media.svelte";

describe("media state", () => {
  it("returns width from metadata", () => {
    expect(media.width).toBe(1920);
  });

  it("returns height from metadata", () => {
    expect(media.height).toBe(1080);
  });

  it("returns id from the driver media", () => {
    expect(media.id).toBe("mock-entry-001");
  });

  it("returns format from the driver media", () => {
    expect(media.format).toBe("video/mp4");
  });

  it("returns url from the driver media when url is set", () => {
    expect(media.url).toBe("/medias/master.m3u8");
  });

  it("constructs url from resource/key when url is not set", () => {
    mockMedia.url = "";
    mockMedia.key = "subdir/video.mp4";
    expect(media.url).toBe("/medias/files/mock-entry-001/subdir/video.mp4");
  });

  it("constructs url from resource only when key is empty", () => {
    mockMedia.url = "";
    mockMedia.key = "";
    expect(media.url).toBe("/medias/files/mock-entry-001");
  });

  it("returns empty string for url when driver returns null", () => {
    // getDriver is already a vi.fn() via the vi.mock factory
    (getDriver as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    expect(media.url).toBe("");
  });
});

describe("media state — error cases", () => {
  it("throws when width is missing", () => {
    mockMedia.meta = { duration: 60, fps: 30, height: 1080 } as any;
    expect(() => media.width).toThrow("width not set in metadata");
  });

  it("throws when height is missing", () => {
    mockMedia.meta = { duration: 60, fps: 30, width: 1920 } as any;
    expect(() => media.height).toThrow("height not set in metadata");
  });
});
