// ---------------------------------------------------------------------------
// media.test.ts — Unit tests for media state
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockMedia = vi.hoisted(() => ({
  id: "mock-entry-001",
  resource: "mock-entry-001",
  key: "",
  mime_type: "video/mp4",
  filename: "test.mp4",
  url: "/medias/master.m3u8",
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
import { media } from "./media.svelte";
import { getDriver } from "./driver.svelte";

describe("media state", () => {
  it("returns duration from metadata", () => {
    expect(media.duration).toBe(60);
  });

  it("returns fps from metadata", () => {
    expect(media.fps).toBe(30);
  });

  it("returns width from metadata", () => {
    expect(media.width).toBe(1920);
  });

  it("returns height from metadata", () => {
    expect(media.height).toBe(1080);
  });

  it("returns dimensions as [width, height]", () => {
    expect(media.dimensions).toEqual([1920, 1080]);
  });

  it("returns totalFrames as rounded duration * fps", () => {
    expect(media.totalFrames).toBe(1800); // 60 * 30
  });

  it("returns id from the driver media", () => {
    expect(media.id).toBe("mock-entry-001");
  });

  it("returns url from the driver media", () => {
    expect(media.url).toBe("/medias/master.m3u8");
  });
});

describe("media state — error cases", () => {
  it("throws when duration is missing", () => {
    mockMedia.meta = { fps: 30, width: 1920, height: 1080 } as any;
    expect(() => media.duration).toThrow("duration not set in metadata");
  });

  it("throws when fps is missing", () => {
    mockMedia.meta = { duration: 60, width: 1920, height: 1080 } as any;
    expect(() => media.fps).toThrow("fps not set in metadata");
  });

  it("throws when width is missing", () => {
    mockMedia.meta = { duration: 60, fps: 30, height: 1080 } as any;
    expect(() => media.width).toThrow("width not set in metadata");
  });

  it("throws when height is missing", () => {
    mockMedia.meta = { duration: 60, fps: 30, width: 1920 } as any;
    expect(() => media.height).toThrow("height not set in metadata");
  });
});