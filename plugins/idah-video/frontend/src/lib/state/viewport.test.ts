// ---------------------------------------------------------------------------
// viewport.test.ts — Unit tests for Viewport state & transform math
//
// Tests the viewport module including:
//   - screenToScene / sceneToScreen round-trips and correctness
//   - isCreationMode based on current mode
//   - mode setter delegates to driver
//   - clampTranslate boundaries (regression: removed "fit-to-center" lock)
//   - fitToViewport centering math
//   - viewportSize calculation
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// Mock driver.svelte so that getDriver() doesn't throw and we can spy on
// setMode.
const mockDriver = vi.hoisted(() => ({
  __setMode: vi.fn(),
  __onModeChange: vi.fn(),
  getDriver: vi.fn(() => ({
    setMode: (val: string) => mockDriver.__setMode(val),
    onModeChange: (cb: (ev: { oldValue: string; newValue: string }) => void) =>
      mockDriver.__onModeChange(cb),
  })),
}));

vi.mock("./driver.svelte", () => ({
  getDriver: mockDriver.getDriver,
}));

// Mock media.svelte so that clampTranslate / fitToViewport / viewportSize
// have controlled dimensions without needing a real driver instance.
// The underlying values can be changed between tests via mediaState.
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
import {
  viewport,
  DEFAULT_MODE,
  BOUNDING_BOX_MODE,
  POLYGON_MODE,
} from "./viewport.svelte";

// See also: default constants
//   DEFAULT_MODE     = "default"
//   BOUNDING_BOX_MODE = "idah-video:bounding-box"
//   POLYGON_MODE      = "idah-video:polygon"

// Before each test, reset media dimensions to the default.
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
    viewport.mode = DEFAULT_MODE;
    expect(viewport.isCreationMode).toBe(false);
  });

  it("returns true when mode is bounding-box", () => {
    viewport.mode = BOUNDING_BOX_MODE;
    expect(viewport.isCreationMode).toBe(true);
  });

  it("returns true when mode is polygon", () => {
    viewport.mode = POLYGON_MODE;
    expect(viewport.isCreationMode).toBe(true);
  });

  it("returns false when mode is note", () => {
    viewport.mode = "note";
    expect(viewport.isCreationMode).toBe(false);
  });

  it("returns false for unknown mode strings", () => {
    viewport.mode = "review";
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
    viewport.mode = BOUNDING_BOX_MODE;
    expect(mockDriver.__setMode).toHaveBeenCalledWith(BOUNDING_BOX_MODE);
  });

  it("does NOT call driver.setMode when mode is already set", () => {
    viewport.mode = DEFAULT_MODE;
    const callsBefore = mockDriver.__setMode.mock.calls.length;

    viewport.mode = DEFAULT_MODE; // same value again

    expect(mockDriver.__setMode).toHaveBeenCalledTimes(callsBefore);
  });

  it("calls driver.setMode on each distinct change", () => {
    viewport.mode = BOUNDING_BOX_MODE;
    viewport.mode = POLYGON_MODE;
    viewport.mode = DEFAULT_MODE;
    expect(mockDriver.__setMode).toHaveBeenCalledTimes(3);
    expect(mockDriver.__setMode).toHaveBeenNthCalledWith(1, BOUNDING_BOX_MODE);
    expect(mockDriver.__setMode).toHaveBeenNthCalledWith(2, POLYGON_MODE);
    expect(mockDriver.__setMode).toHaveBeenNthCalledWith(3, DEFAULT_MODE);
  });
});

// ---------------------------------------------------------------------------
// fitToViewport
// ---------------------------------------------------------------------------

describe("fitToViewport", () => {
  beforeEach(() => resetViewport());

  it("centers a 1920×1080 media in a 1280×720 viewport (16:9 → 16:9)", () => {
    setViewportDimensions(1280, 720);
    viewport.workspace.fitToViewport();

    const { translate, scale } = viewport.workspace.transform;
    // Scale = min(1280/1920, 720/1080) = min(0.6667, 0.6667) = 0.6667
    expect(scale).toBeCloseTo(720 / 1080, 5);
    // Centered: tx = (1280 - 1920 * 0.6667) / 2 = 0
    expect(translate[0]).toBeCloseTo(0, 1);
    // Centered: ty = (720 - 1080 * 0.6667) / 2 = 0
    expect(translate[1]).toBeCloseTo(0, 1);
  });

  it("centers a 1920×1080 media in a 800×600 viewport (narrower viewport)", () => {
    setViewportDimensions(800, 600);
    viewport.workspace.fitToViewport();

    const { translate, scale } = viewport.workspace.transform;
    // Scale fits by width: 800/1920 ≈ 0.4167 (narrower than 16:9 → constrained by width)
    expect(scale).toBeCloseTo(800 / 1920, 5);
    // Centered vertically: ty = (600 - 1080*0.4167) / 2
    const expectedTy = (600 - 1080 * (800 / 1920)) / 2;
    expect(translate[1]).toBeCloseTo(expectedTy, 1);
    expect(translate[0]).toBeCloseTo(0, 1);
  });

  it("centers a 1920×1080 media in a 1024×768 viewport (taller viewport)", () => {
    setViewportDimensions(1024, 768);
    viewport.workspace.fitToViewport();

    const { translate, scale } = viewport.workspace.transform;
    // Scale fits by width: 1024/1920 ≈ 0.5333
    expect(scale).toBeCloseTo(1024 / 1920, 5);
    // Centered vertically: ty = (768 - 1080*0.5333) / 2
    const expectedTy = (768 - 1080 * (1024 / 1920)) / 2;
    expect(translate[1]).toBeCloseTo(expectedTy, 1);
    expect(translate[0]).toBeCloseTo(0, 1);
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
// clampTranslate — the key fix for "cannot drag if fully displayed"
//
// The REGRESSION we're testing: The old code would force content that was
// smaller than the viewport to be centered (not allowing panning). The new
// code allows free panning while only preventing edges from going past the
// opposite edge (leaving at least MARGIN = 20px visible).
// ---------------------------------------------------------------------------

describe("clampTranslate", () => {
  beforeEach(() => resetViewport());

  describe("content smaller than viewport (fully visible)", () => {
    // 1920×1080 media scaled to 0.5 = 960×540, in a 1280×720 viewport
    beforeEach(() => {
      setViewportDimensions(1280, 720);
      viewport.workspace.transform.scale = 0.5;
    });

    it("allows off-center panning (does NOT force center)", () => {
      // Try to push the content far left – should be clamped, not centered
      viewport.workspace.transform.translate = [-500, 0];
      viewport.workspace.clampTranslate();

      const { translate } = viewport.workspace.transform;
      // Right edge (tx + 960) must be at least 20 → tx >= 20 - 960 = -940
      // So -500 is valid as long as it's >= -940
      expect(translate[0]).toBeGreaterThanOrEqual(-940);
      expect(translate[1]).toBeGreaterThanOrEqual(-520);
    });

    it("clamps left edge translation (too far right)", () => {
      viewport.workspace.transform.translate = [500, 300];
      viewport.workspace.clampTranslate();

      const { translate } = viewport.workspace.transform;
      // Left edge (tx) must be at most vw - MARGIN = 1280 - 20 = 1260
      expect(translate[0]).toBeLessThanOrEqual(1260);
      expect(translate[1]).toBeLessThanOrEqual(700);
    });

    it("clamps right edge translation (too far left)", () => {
      viewport.workspace.transform.translate = [-2000, -1000];
      viewport.workspace.clampTranslate();

      const { translate } = viewport.workspace.transform;
      // Right edge (tx + 960) must be at least 20 → tx >= 20 - 960 = -940
      expect(translate[0]).toBeGreaterThanOrEqual(-940);
      expect(translate[1]).toBeGreaterThanOrEqual(-520);
    });

    it("keeps a reasonable off-center position unclamped", () => {
      // Shift fully to the right but within bounds
      viewport.workspace.transform.translate = [300, 0];
      viewport.workspace.clampTranslate();

      const { translate } = viewport.workspace.transform;
      // 300 should be within [-940, 1260] so it stays unchanged
      expect(translate[0]).toBe(300);
      expect(translate[1]).toBe(0);
    });
  });

  describe("content larger than viewport", () => {
    // 1920×1080 media at scale 2 = 3840×2160, in a 1280×720 viewport
    beforeEach(() => {
      setViewportDimensions(1280, 720);
      viewport.workspace.transform.scale = 2;
    });

    it("clamps when panned too far left", () => {
      viewport.workspace.transform.translate = [-3000, 0];
      viewport.workspace.clampTranslate();

      const { translate } = viewport.workspace.transform;
      // scaledW = 3840. Right edge: tx + 3840 >= 20 → tx >= -3820
      expect(translate[0]).toBeGreaterThanOrEqual(-3820);
    });

    it("clamps when panned too far right", () => {
      viewport.workspace.transform.translate = [2000, 0];
      viewport.workspace.clampTranslate();

      const { translate } = viewport.workspace.transform;
      // Left edge: tx <= 1280 - 20 = 1260
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
// viewportSize
// ---------------------------------------------------------------------------

describe("viewportSize", () => {
  beforeEach(() => resetViewport());

  it("returns [0,0,1,1] when centered and scale=1 in a 1920×1080 viewport", () => {
    setViewportDimensions(1920, 1080);
    viewport.workspace.transform.translate = [0, 0];
    viewport.workspace.transform.scale = 1;
    // With media = 1920×1080 and viewport = 1920×1080:
    // left   = 0 / 1920 = 0
    // top    = 0 / 1080 = 0
    // right  = 1920 / 1920 = 1
    // bottom = 1080 / 1080 = 1
    const vs = viewport.workspace.viewportSize;
    expect(vs[0]).toBeCloseTo(0);
    expect(vs[1]).toBeCloseTo(0);
    expect(vs[2]).toBeCloseTo(1);
    expect(vs[3]).toBeCloseTo(1);
  });

  it("reflects a panned viewport", () => {
    setViewportDimensions(1280, 720);
    viewport.workspace.transform.translate = [100, 50];
    viewport.workspace.transform.scale = 1;
    // media = 1920×1080, viewport = 1280×720
    // left   = -100 / 1920 ≈ -0.052
    // top    = -50  / 1080 ≈ -0.046
    // right  = (-100 + 1280) / 1920 ≈ 0.615
    // bottom = (-50  + 720)  / 1080 ≈ 0.620
    const vs = viewport.workspace.viewportSize;
    expect(vs[0]).toBeCloseTo(-100 / 1920, 5);
    expect(vs[1]).toBeCloseTo(-50 / 1080, 5);
    expect(vs[2]).toBeCloseTo(1180 / 1920, 5);
    expect(vs[3]).toBeCloseTo(670 / 1080, 5);
  });

  it("scales correctly", () => {
    setViewportDimensions(1280, 720);
    viewport.workspace.transform.translate = [200, 100];
    viewport.workspace.transform.scale = 2;
    // left   = -200 / (2 * 1920) = -200 / 3840 ≈ -0.052
    // top    = -100 / (2 * 1080) = -100 / 2160 ≈ -0.046
    // right  = (-200 + 1280) / 3840 ≈ 0.281
    // bottom = (-100 + 720)  / 2160 ≈ 0.287
    const vs = viewport.workspace.viewportSize;
    expect(vs[0]).toBeCloseTo(-200 / 3840, 5);
    expect(vs[1]).toBeCloseTo(-100 / 2160, 5);
    expect(vs[2]).toBeCloseTo(1080 / 3840, 5);
    expect(vs[3]).toBeCloseTo(620 / 2160, 5);
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
