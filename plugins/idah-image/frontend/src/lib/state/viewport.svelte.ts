import { getDriver } from "./driver.svelte";
import { media } from "./media.svelte";

// List of viewport modes
export const DEFAULT_MODE = "default";
export const NOTE_MODE = "note";
export const BOUNDING_BOX_MODE = "idah-image:bounding-box";
export const POLYGON_MODE = "idah-image:polygon";

class Viewport {
  // Only mode needs special handling
  #mode = $state(DEFAULT_MODE);

  get mode() {
    return this.#mode;
  }
  get isCreationMode() {
    return ["idah-image:polygon", "idah-image:bounding-box"].includes(this.#mode);
  }

  set mode(val: string) {
    if (this.#mode === val) return;
    this.#mode = val;
    getDriver().setMode(val);
  }

  // video = $state({
  //   currentFrame: { value: 0 },
  //   status: "pause" as "play" | "pause",
  //   sound: { level: 0.0, muted: true },
  //   play() {
  //     this.status = "play";
  //   },
  //   pause() {
  //     this.status = "pause";
  //   },
  // });

  image = $state({
    currentFrame: { value: 0 },
    dimensions: [0, 0] as [number, number],
  });

  workspace = $state({
    transform: {
      translate: [0, 0] as [number, number],
      scale: 1.0,
    },
    dimensions: [0, 0] as [number, number],

    /**
     * Fit the image to fill the viewport while maintaining aspect ratio.
     * Call this when dimensions are first known or after a resize.
     */
    fitToViewport() {
      const [vw, vh] = this.dimensions;
      const [mw, mh] = media.dimensions;

      if (vw <= 0 || vh <= 0 || mw <= 0 || mh <= 0) return;

      const scaleX = vw / mw;
      const scaleY = vh / mh;

      const scale = Math.min(scaleX, scaleY);

      this.transform = {
        translate: [(vw - mw * scale) / 2, (vh - mh * scale) / 2],
        scale: Math.max(1, scale),
      };
    },

    /**
     * Clamp translation so the image never fully leaves the viewport.
     * At least 20px of the image content will always be visible on each axis.
     * Call this after any translate/scale change.
     */
    clampTranslate() {
      const [vw, vh] = this.dimensions;
      const [mw, mh] = media.dimensions;
      if (vw <= 0 || vh <= 0 || mw <= 0 || mh <= 0) return;
      const { translate, scale } = this.transform;
      const scaledW = mw * scale;
      const scaledH = mh * scale;
      const MARGIN = 20;

      let [tx, ty] = translate;

      // ── Horizontal clamping ───────────────────────────────────────
      // Prevent the right edge from moving too far left:
      if (tx + scaledW < MARGIN) tx = MARGIN - scaledW;
      // Prevent the left edge from moving too far right:
      if (tx > vw - MARGIN) tx = vw - MARGIN;

      // ── Vertical clamping ─────────────────────────────────────────
      // Prevent the bottom edge from moving too far up:
      if (ty + scaledH < MARGIN) ty = MARGIN - scaledH;
      // Prevent the top edge from moving too far down:
      if (ty > vh - MARGIN) ty = vh - MARGIN;

      this.transform.translate = [tx, ty];
    },

    screenToScene(sx: number, sy: number) {
      const t = this.transform;
      return { x: (sx - t.translate[0]) / t.scale, y: (sy - t.translate[1]) / t.scale };
    },
    sceneToScreen(x: number, y: number) {
      const t = this.transform;
      return { x: x * t.scale + t.translate[0], y: y * t.scale + t.translate[1] };
    },
    get viewportSize(): number[] {
      const t = this.transform;
      const d = this.dimensions;
      const m = media.dimensions;
      const s = t.scale;

      return [
        -t.translate[0] / (s * m[0]),
        -t.translate[1] / (s * m[1]),
        (-t.translate[0] + d[0]) / (s * m[0]),
        (-t.translate[1] + d[1]) / (s * m[1]),
      ];
    },
  });
}

export const viewport = new Viewport();
