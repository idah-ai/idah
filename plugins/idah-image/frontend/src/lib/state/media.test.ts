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
  meta: { width: 1920, height: 1080 },
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
    expect(media.format).toBe("image/jpeg");
  });

  it("returns url from the driver media", () => {
    expect(media.url).toBe("/medias/master.jpg");
  });
});

describe("media state — error cases", () => {
  it("throws when width is missing", () => {
    mockMedia.meta = { height: 1080 } as any;
    expect(() => media.width).toThrow("width not set in metadata");
  });

  it("throws when height is missing", () => {
    mockMedia.meta = { width: 1920 } as any;
    expect(() => media.height).toThrow("height not set in metadata");
  });
});
