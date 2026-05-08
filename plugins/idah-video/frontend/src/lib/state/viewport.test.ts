// ---------------------------------------------------------------------------
// viewport.test.ts — Unit tests for Viewport transform math
//
// Tests the actual viewport.workspace instance (screenToScene / sceneToScreen)
// by manipulating its transform state directly.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { viewport } from "./viewport.svelte";

// The viewport module uses $state at module level, which requires Svelte 5
// runes to be available. In vitest with the svelte plugin, this works.
// We test the real methods by mutating the reactive state directly.

// ─── Round-trip identity property ─────────────────────────────────────────

describe("transform round-trip", () => {
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

// ─── Individual method correctness ────────────────────────────────────────

describe("screenToScene", () => {
  it("converts a screen point to scene coordinates correctly", () => {
    viewport.workspace.transform.translate = [100, 50];
    viewport.workspace.transform.scale = 2;
    const result = viewport.workspace.screenToScene(300, 150);
    expect(result.x).toBe(100); // (300 - 100) / 2
    expect(result.y).toBe(50);  // (150 - 50) / 2
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
