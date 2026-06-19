// ---------------------------------------------------------------------------
// viewport.test.ts — Unit tests for Viewport state & transform math
//
// Tests the viewport module including:
//   - screenToScene / sceneToScreen round-trips and correctness
//   - isCreationMode based on current mode
//   - mode setter delegates to driver
//   - clampTranslate boundaries
//   - fitToViewport with Math.min(scaleX, scaleY)
//   - viewportSize (normalized 0-1 via media dimensions)
// ---------------------------------------------------------------------------
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockDriver = vi.hoisted(() => ({
  __setMode: vi.fn(),
  __onModeChange: vi.fn(),
  getDriver: vi.fn(() => ({
    setMode: (val: string) => mockDriver.__setMode(val),
    onModeChange: (cb: (ev: { oldValue: string; newValue: string }) => void) => mockDriver.__onModeChange(cb),
  })),
}));

vi.mock("./driver.svelte", () => ({
  getDriver: mockDriver.getDriver,
}));

const mediaState = vi.hoisted(() => ({ width: 1920, height: 1080 }));

vi.mock("./media.svelte", () => ({
  media: {
    get dimensions() {
      return [mediaState.width, mediaState.height];
    },
    get width() {
      return mediaState.width;
    },
    get height() {
      return mediaState.height;
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are set up)
// ---------------------------------------------------------------------------
import { viewport } from "./viewport.svelte";
import { IMAGE_BOUNDING_BOX, IMAGE_POLYGON, REVIEW_MODE } from "$lib/types";

// Helpers
function setMediaDimensions(w: number, h: number) {
  mediaState.width = w;
  mediaState.height = h;
}

function setViewportDimensions(w: number, h: number) {
  viewport.workspace.dimensions = [w, h];
}

function resetViewport() {
  viewport.workspace.transform.translate = [0, 0];
  viewport.workspace.transform.scale = 1;
  viewport.workspace.dimensions = [0, 0];
  setMediaDimensions(1920, 1080);
  mockDriver.__setMode.mockClear();
  mockDriver.__onModeChange.mockClear();
}

// ---------------------------------------------------------------------------
// isCreationMode
// ---------------------------------------------------------------------------

describe("isCreationMode", () => {
  beforeEach(() => resetViewport());

  it("returns false when mode is default", () => {
    viewport.mode = "editor";
    expect(viewport.isCreationMode).toBe(false);
  });

  it("returns true when mode is bounding-box", () => {
    viewport.mode = IMAGE_BOUNDING_BOX;
    expect(viewport.isCreationMode).toBe(true);
  });

  it("returns true when mode is polygon", () => {
    viewport.mode = IMAGE_POLYGON;
    expect(viewport.isCreationMode).toBe(true);
  });

  it("returns false when mode is note", () => {
    viewport.mode = "note";
    expect(viewport.isCreationMode).toBe(false);
  });

  it("returns false for unknown mode strings", () => {
    viewport.mode = REVIEW_MODE;
    expect(viewport.isCreationMode).toBe(false);
    viewport.mode = "some-random-mode";
    expect(viewport.isCreationMode).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mode setter → driver delegation
// ---------------------------------------------------------------------------

describe("mode setter", () => {
  beforeEach(() => resetViewport());

  it("calls driver.setMode when mode changes", () => {
    viewport.mode = IMAGE_BOUNDING_BOX;
    expect(mockDriver.__setMode).toHaveBeenCalledWith(IMAGE_BOUNDING_BOX);
  });

  it("does NOT call driver.setMode when mode is already set", () => {
    viewport.mode = "editor";
    const callsBefore = mockDriver.__setMode.mock.calls.length;

    viewport.mode = "editor";

    expect(mockDriver.__setMode).toHaveBeenCalledTimes(callsBefore);
  });

  it("calls driver.setMode on each distinct change", () => {
    viewport.mode = IMAGE_BOUNDING_BOX;
    viewport.mode = IMAGE_POLYGON;
    viewport.mode = "editor";
    expect(mockDriver.__setMode).toHaveBeenCalledTimes(3);
    expect(mockDriver.__setMode).toHaveBeenNthCalledWith(1, IMAGE_BOUNDING_BOX);
    expect(mockDriver.__setMode).toHaveBeenNthCalledWith(2, IMAGE_POLYGON);
    expect(mockDriver.__setMode).toHaveBeenNthCalledWith(3, "editor");
  });
});

// ---------------------------------------------------------------------------
// fitToViewport
//
// NOTE: fitToViewport uses Math.min(scaleX, scaleY) — scale is NOT clamped
// to a minimum of 1.0. When the viewport is smaller than the media, scale
// will be < 1 (the image is shrunk to fit).
// ---------------------------------------------------------------------------

describe("fitToViewport", () => {
  beforeEach(() => resetViewport());

  it("scale < 1 when viewport is smaller than 1920×1080 media (16:9 → 16:9)", () => {
    setViewportDimensions(1280, 720);
    viewport.workspace.fitToViewport();

    const { translate, scale } = viewport.workspace.transform;
    // scale = min(1280/1920, 720/1080) = 0.6667
    expect(scale).toBeCloseTo(1280 / 1920, 5);
    // tx = (1280 - 1920*0.6667) / 2 ≈ 0, ty = (720 - 1080*0.6667) / 2 ≈ 0
    expect(translate[0]).toBeCloseTo(0, 1);
    expect(translate[1]).toBeCloseTo(0, 1);
  });

  it("scale < 1 when narrower viewport forces width-constrained fit", () => {
    setViewportDimensions(800, 600);
    viewport.workspace.fitToViewport();

    const { translate, scale } = viewport.workspace.transform;
    // scale = min(800/1920, 600/1080) = min(0.4167, 0.5556) = 0.4167
    expect(scale).toBeCloseTo(800 / 1920, 5);
    // tx = (800 - 1920*0.4167) / 2 ≈ 0, ty = (600 - 1080*0.4167) / 2 ≈ 75
    expect(translate[0]).toBeCloseTo(0, 1);
    expect(translate[1]).toBeCloseTo((600 - 1080 * (800 / 1920)) / 2, 1);
  });

  it("scale < 1 when taller viewport forces height-constrained fit", () => {
    setViewportDimensions(1024, 768);
    viewport.workspace.fitToViewport();

    const { translate, scale } = viewport.workspace.transform;
    // scale = min(1024/1920, 768/1080) = min(0.5333, 0.7111) = 0.5333
    expect(scale).toBeCloseTo(1024 / 1920, 5);
    // tx = (1024 - 1920*0.5333) / 2 ≈ 0, ty = (768 - 1080*0.5333) / 2 ≈ 96
    expect(translate[0]).toBeCloseTo(0, 1);
    expect(translate[1]).toBeCloseTo((768 - 1080 * (1024 / 1920)) / 2, 1);
  });

  it("allows scale > 1 when viewport is larger than media", () => {
    setViewportDimensions(3840, 2160);
    viewport.workspace.fitToViewport();

    const { translate, scale } = viewport.workspace.transform;
    // scaleX = 3840/1920 = 2, scaleY = 2160/1080 = 2 → scale = 2 (already > 1)
    expect(scale).toBeCloseTo(2, 5);
    // tx = (3840 - 1920*2) / 2 = 0
    expect(translate[0]).toBeCloseTo(0, 1);
    expect(translate[1]).toBeCloseTo(0, 1);
  });

  it("scale > 1 when viewport is taller but media short", () => {
    // 2000×2000 viewport, 1920×1080 media — height-constrained
    setViewportDimensions(2000, 2000);
    viewport.workspace.fitToViewport();

    const { translate, scale } = viewport.workspace.transform;
    // scaleX = 2000/1920 = 1.0417, scaleY = 2000/1080 = 1.8519 → scale = min(1.0417, 1.8519) = 1.0417
    expect(scale).toBeCloseTo(2000 / 1920, 5);
    // tx = (2000 - 1920*1.0417) / 2 ≈ 0
    expect(translate[0]).toBeCloseTo(0, 1);
    // ty = (2000 - 1080*1.0417) / 2 = (2000 - 1125) / 2 = 437.5
    expect(translate[1]).toBeCloseTo((2000 - 1080 * (2000 / 1920)) / 2, 1);
  });

  it("is a no-op when viewport dimensions are zero", () => {
    setViewportDimensions(0, 0);
    viewport.workspace.transform.translate = [100, 100];
    viewport.workspace.fitToViewport();
    expect(viewport.workspace.transform.translate).toEqual([100, 100]);
    expect(viewport.workspace.transform.scale).toBe(1);
  });

  it("is a no-op when media dimensions are zero", () => {
    setMediaDimensions(0, 0);
    setViewportDimensions(1280, 720);
    viewport.workspace.transform.translate = [50, 50];
    viewport.workspace.fitToViewport();
    expect(viewport.workspace.transform.translate).toEqual([50, 50]);
    expect(viewport.workspace.transform.scale).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// clampTranslate
// ---------------------------------------------------------------------------

describe("clampTranslate", () => {
  beforeEach(() => resetViewport());

  describe("content smaller than viewport (fully visible)", () => {
    beforeEach(() => {
      setViewportDimensions(1280, 720);
      viewport.workspace.transform.scale = 0.5;
    });

    it("allows off-center panning (does NOT force center)", () => {
      viewport.workspace.transform.translate = [-500, 0];
      viewport.workspace.clampTranslate();

      const { translate } = viewport.workspace.transform;
      // scaledW = 1920*0.5 = 960. Right edge (tx + 960) must be >= 20 → tx >= -940
      expect(translate[0]).toBeGreaterThanOrEqual(-940);
      expect(translate[1]).toBeGreaterThanOrEqual(-520);
    });

    it("clamps left edge translation (too far right)", () => {
      viewport.workspace.transform.translate = [500, 300];
      viewport.workspace.clampTranslate();

      const { translate } = viewport.workspace.transform;
      // Left edge (tx) must be <= vw - 20 = 1260
      expect(translate[0]).toBeLessThanOrEqual(1260);
      expect(translate[1]).toBeLessThanOrEqual(700);
    });

    it("clamps right edge translation (too far left)", () => {
      viewport.workspace.transform.translate = [-2000, -1000];
      viewport.workspace.clampTranslate();

      const { translate } = viewport.workspace.transform;
      // scaledW = 960 → right edge >= 20 → tx >= -940
      expect(translate[0]).toBeGreaterThanOrEqual(-940);
      expect(translate[1]).toBeGreaterThanOrEqual(-520);
    });

    it("keeps a reasonable off-center position unclamped", () => {
      viewport.workspace.transform.translate = [300, 0];
      viewport.workspace.clampTranslate();

      const { translate } = viewport.workspace.transform;
      expect(translate[0]).toBe(300);
      expect(translate[1]).toBe(0);
    });
  });

  describe("content larger than viewport", () => {
    beforeEach(() => {
      setViewportDimensions(1280, 720);
      viewport.workspace.transform.scale = 2;
    });

    it("clamps when panned too far left", () => {
      viewport.workspace.transform.translate = [-3000, 0];
      viewport.workspace.clampTranslate();

      const { translate } = viewport.workspace.transform;
      // scaledW = 3840 → right edge >= 20 → tx >= -3820
      expect(translate[0]).toBeGreaterThanOrEqual(-3820);
    });

    it("clamps when panned too far right", () => {
      viewport.workspace.transform.translate = [2000, 0];
      viewport.workspace.clampTranslate();

      const { translate } = viewport.workspace.transform;
      // tx <= 1260
      expect(translate[0]).toBeLessThanOrEqual(1260);
    });
  });

  describe("edge cases", () => {
    it("is a no-op when viewport dimensions are zero", () => {
      setViewportDimensions(0, 0);
      viewport.workspace.transform.translate = [500, 500];
      viewport.workspace.clampTranslate();
      expect(viewport.workspace.transform.translate).toEqual([500, 500]);
    });

    it("is a no-op when media dimensions are zero", () => {
      setMediaDimensions(0, 0);
      setViewportDimensions(1280, 720);
      viewport.workspace.transform.translate = [500, 500];
      viewport.workspace.clampTranslate();
      expect(viewport.workspace.transform.translate).toEqual([500, 500]);
    });

    it("keeps value unchanged when already within bounds", () => {
      setViewportDimensions(1280, 720);
      viewport.workspace.transform.scale = 1;
      viewport.workspace.transform.translate = [100, 50];
      viewport.workspace.clampTranslate();
      expect(viewport.workspace.transform.translate).toEqual([100, 50]);
    });
  });
});

// ---------------------------------------------------------------------------
// viewportSize — normalized 0-1 (divided by s * mediaDimensions)
// ---------------------------------------------------------------------------

describe("viewportSize", () => {
  beforeEach(() => resetViewport());

  it("returns [0, 0, 1, 1] when viewport matches media and centered at scale 1", () => {
    setViewportDimensions(1920, 1080);
    viewport.workspace.transform.translate = [0, 0];
    viewport.workspace.transform.scale = 1;
    // left   = -0 / (1*1920) = 0
    // top    = -0 / (1*1080) = 0
    // right  = (-0 + 1920) / (1*1920) = 1
    // bottom = (-0 + 1080) / (1*1080) = 1
    const vs = viewport.workspace.viewportSize;
    expect(vs[0]).toBeCloseTo(0);
    expect(vs[1]).toBeCloseTo(0);
    expect(vs[2]).toBeCloseTo(1);
    expect(vs[3]).toBeCloseTo(1);
  });

  it("reflects a panned viewport in normalized media space", () => {
    setViewportDimensions(1280, 720);
    viewport.workspace.transform.translate = [100, 50];
    viewport.workspace.transform.scale = 1;
    // left   = -100 / (1*1920) = -0.05208
    // top    = -50  / (1*1080) = -0.04630
    // right  = (-100 + 1280) / (1*1920) = 1180/1920 = 0.61458
    // bottom = (-50  + 720)  / (1*1080) = 670/1080  = 0.62037
    const vs = viewport.workspace.viewportSize;
    expect(vs[0]).toBeCloseTo(-100 / 1920, 5);
    expect(vs[1]).toBeCloseTo(-50 / 1080, 5);
    expect(vs[2]).toBeCloseTo((-100 + 1280) / 1920, 5);
    expect(vs[3]).toBeCloseTo((-50 + 720) / 1080, 5);
  });

  it("accounts for scale 2 in normalized media space", () => {
    setViewportDimensions(1280, 720);
    viewport.workspace.transform.translate = [200, 100];
    viewport.workspace.transform.scale = 2;
    // left   = -200 / (2*1920) = -200/3840 = -0.05208
    // top    = -100 / (2*1080) = -100/2160 = -0.04630
    // right  = (-200 + 1280) / (2*1920) = 1080/3840 = 0.28125
    // bottom = (-100 + 720)  / (2*1080) = 620/2160  = 0.28704
    const vs = viewport.workspace.viewportSize;
    expect(vs[0]).toBeCloseTo(-200 / (2 * 1920), 5);
    expect(vs[1]).toBeCloseTo(-100 / (2 * 1080), 5);
    expect(vs[2]).toBeCloseTo((-200 + 1280) / (2 * 1920), 5);
    expect(vs[3]).toBeCloseTo((-100 + 720) / (2 * 1080), 5);
  });

  it("accounts for scale 0.5 in normalized media space", () => {
    setViewportDimensions(1280, 720);
    viewport.workspace.transform.translate = [400, 300];
    viewport.workspace.transform.scale = 0.5;
    // left   = -400 / (0.5*1920) = -400/960 = -0.41667
    // top    = -300 / (0.5*1080) = -300/540 = -0.55556
    // right  = (-400 + 1280) / (0.5*1920) = 880/960 = 0.91667
    // bottom = (-300 + 720)  / (0.5*1080) = 420/540 = 0.77778
    const vs = viewport.workspace.viewportSize;
    expect(vs[0]).toBeCloseTo(-400 / (0.5 * 1920), 5);
    expect(vs[1]).toBeCloseTo(-300 / (0.5 * 1080), 5);
    expect(vs[2]).toBeCloseTo((-400 + 1280) / (0.5 * 1920), 5);
    expect(vs[3]).toBeCloseTo((-300 + 720) / (0.5 * 1080), 5);
  });
});

// ─── Transform round-trip ─────────────────────────────────────────────────

describe("transform round-trip", () => {
  beforeEach(() => resetViewport());

  it("sceneToScreen(screenToScene(p)) returns the original screen point", () => {
    viewport.workspace.transform.translate = [100, 50];
    viewport.workspace.transform.scale = 1;
    const screenPt = { x: 200, y: 150 };
    const scene = viewport.workspace.screenToScene(screenPt.x, screenPt.y);
    const back = viewport.workspace.sceneToScreen(scene.x, scene.y);
    expect(back.x).toBeCloseTo(screenPt.x);
    expect(back.y).toBeCloseTo(screenPt.y);
  });

  it("screenToScene(sceneToScreen(p)) returns the original scene point", () => {
    viewport.workspace.transform.translate = [100, 50];
    viewport.workspace.transform.scale = 1;
    const scenePt = { x: 0.5, y: 0.3 };
    const screen = viewport.workspace.sceneToScreen(scenePt.x, scenePt.y);
    const back = viewport.workspace.screenToScene(screen.x, screen.y);
    expect(back.x).toBeCloseTo(scenePt.x);
    expect(back.y).toBeCloseTo(scenePt.y);
  });

  it("round-trips with non-zero translate and scale 2", () => {
    viewport.workspace.transform.translate = [300, 200];
    viewport.workspace.transform.scale = 2;
    const screenPt = { x: 100, y: 50 };
    const scene = viewport.workspace.screenToScene(screenPt.x, screenPt.y);
    const back = viewport.workspace.sceneToScreen(scene.x, scene.y);
    expect(back.x).toBeCloseTo(screenPt.x);
    expect(back.y).toBeCloseTo(screenPt.y);
  });

  it("round-trips with negative translate and scale 1.5", () => {
    viewport.workspace.transform.translate = [-400, -300];
    viewport.workspace.transform.scale = 1.5;
    const screenPt = { x: 800, y: 600 };
    const scene = viewport.workspace.screenToScene(screenPt.x, screenPt.y);
    const back = viewport.workspace.sceneToScreen(scene.x, scene.y);
    expect(back.x).toBeCloseTo(screenPt.x);
    expect(back.y).toBeCloseTo(screenPt.y);
  });

  it("round-trips with scale 0.5 and large translate", () => {
    viewport.workspace.transform.translate = [1200, 800];
    viewport.workspace.transform.scale = 0.5;
    const screenPt = { x: 500, y: 300 };
    const scene = viewport.workspace.screenToScene(screenPt.x, screenPt.y);
    const back = viewport.workspace.sceneToScreen(scene.x, scene.y);
    expect(back.x).toBeCloseTo(screenPt.x);
    expect(back.y).toBeCloseTo(screenPt.y);
  });

  it("round-trips with identity transform (no translate, scale 1)", () => {
    viewport.workspace.transform.translate = [0, 0];
    viewport.workspace.transform.scale = 1;
    const screenPt = { x: 1920, y: 1080 };
    const scene = viewport.workspace.screenToScene(screenPt.x, screenPt.y);
    const back = viewport.workspace.sceneToScreen(scene.x, scene.y);
    expect(back.x).toBeCloseTo(screenPt.x);
    expect(back.y).toBeCloseTo(screenPt.y);
  });

  it("round-trips with fractional and negative coordinates", () => {
    viewport.workspace.transform.translate = [-100, 200];
    viewport.workspace.transform.scale = 0.3;
    const screenPt = { x: -50.25, y: 123.75 };
    const scene = viewport.workspace.screenToScene(screenPt.x, screenPt.y);
    const back = viewport.workspace.sceneToScreen(scene.x, scene.y);
    expect(back.x).toBeCloseTo(screenPt.x);
    expect(back.y).toBeCloseTo(screenPt.y);
  });
});

// ─── Individual transform method correctness ──────────────────────────────

describe("screenToScene", () => {
  beforeEach(() => resetViewport());

  it("converts a screen point to scene coordinates correctly", () => {
    viewport.workspace.transform.translate = [100, 50];
    viewport.workspace.transform.scale = 2;
    const result = viewport.workspace.screenToScene(300, 150);
    expect(result.x).toBe(100); // (300 - 100) / 2
    expect(result.y).toBe(50); // (150 - 50) / 2
  });

  it("returns 0, 0 at the translate origin", () => {
    viewport.workspace.transform.translate = [200, 100];
    viewport.workspace.transform.scale = 1.5;
    const result = viewport.workspace.screenToScene(200, 100);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});

describe("sceneToScreen", () => {
  beforeEach(() => resetViewport());

  it("converts a scene point to screen coordinates correctly", () => {
    viewport.workspace.transform.translate = [100, 50];
    viewport.workspace.transform.scale = 2;
    const result = viewport.workspace.sceneToScreen(100, 50);
    expect(result.x).toBe(300); // 100 * 2 + 100
    expect(result.y).toBe(150); // 50 * 2 + 50
  });

  it("returns the translate offset at scene origin", () => {
    viewport.workspace.transform.translate = [200, 100];
    viewport.workspace.transform.scale = 1.5;
    const result = viewport.workspace.sceneToScreen(0, 0);
    expect(result.x).toBe(200);
    expect(result.y).toBe(100);
  });
});
