import { getDriver } from "./driver.svelte";
import { media } from "./media.svelte";

// List of viewport modes
export const DEFAULT_MODE = "default";
export const NOTE_MODE = "note";
export const BOUNDING_BOX_MODE = "idah-video:bounding-box";
export const POLYGON_MODE = "idah-video:polygon";

class Viewport {
  // Only mode needs special handling
  #mode = $state(DEFAULT_MODE);

  get mode() {
    return this.#mode;
  }
  get isCreationMode() {
    return ["idah-video:polygon", "idah-video:bounding-box"].includes(this.#mode);
  }

  set mode(val: string) {
    if (this.#mode === val) return;
    this.#mode = val;
    getDriver().setMode(val);
  }

  timeline = $state({
    range: { startRange: 0, endRange: 0 },
    dimensions: [0, 0] as [number, number],
  });

  video = $state({
    currentFrame: { value: 0 },
    // displayedFrame trails currentFrame — it is only updated once the video
    // element has confirmed the new position (seeked event, RAF tick, pause).
    // The annotation layer reads this so annotations never jump ahead of the
    // actual video pixels on screen.
    displayedFrame: { value: 0 },
    // Consolidated loading state read by LoadingIndicator.svelte.
    //   highQuality — true while an HLS high-quality fragment is being fetched.
    //   qualityLabel — human-readable label for the quality level ("1080p", …).
    //   framePending — true when currentFrame ≠ displayedFrame (seek in flight).
    loading: {
      highQuality: false,
      qualityLabel: "",
    },
    get framePending() {
      return this.status == "pause" && this.currentFrame.value !== this.displayedFrame.value;
    },
    status: "pause" as "play" | "pause",
    sound: { level: 0.0, muted: true },
    // When the last position-changing navigation was requested. stepBy uses
    // it to tell a seek that is still loading (block further steps) from one
    // that is stuck (let the user move again).
    lastSeekRequestAt: 0,
    play() {
      this.status = "play";
    },
    pause() {
      this.status = "pause";
    },
    goToFrame(frame: number) {
      // Clamp to the valid range so `framePending` (derived from
      // currentFrame !== displayedFrame) can never latch on out-of-range
      // writes — displayedFrame is always clamped by timeToFrame, so an
      // unclamped currentFrame would leave the two permanently unequal and
      // freeze the FramePendingOverlay over the annotation layer.
      const total = media.totalFrames;
      const max = total > 0 ? total - 1 : frame;
      const next = Math.max(0, Math.min(frame, max));
      if (next !== this.currentFrame.value) this.lastSeekRequestAt = Date.now();
      this.currentFrame.value = next;
    },
    // Relative stepping (arrow keys, skip buttons). Steps are *dropped* while
    // the previous paused seek hasn't painted yet, so the user only moves
    // through frames they have actually seen — annotations track every
    // painted frame instead of snapping several frames at once when a slow
    // load lands. Buffered seeks confirm on the next video frame callback
    // (~one vsync), so the gate is imperceptible there; it only bites while
    // data is loading. Dropped, not queued: queued steps would replay
    // invisible movement later, recreating the jump this exists to prevent.
    // Absolute jumps (goToFrame callers: timeline, keyframe navigation, the
    // frame input) stay ungated, and a pending seek older than the escape
    // window stops blocking — a seek that never paints (network died
    // mid-load) must not lock navigation.
    stepBy(delta: number) {
      if (this.framePending && Date.now() - this.lastSeekRequestAt < FRAME_STEP_ESCAPE_MS) return;
      this.goToFrame(this.currentFrame.value + delta);
    },
  });

  workspace = $state({
    transform: {
      translate: [0, 0] as [number, number],
      scale: 1.0,
    },
    dimensions: [0, 0] as [number, number],

    /**
     * Fit the video to fill the viewport while maintaining aspect ratio.
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
        scale,
      };
    },

    /**
     * Clamp translation so the video never fully leaves the viewport.
     * At least 20px of the video content will always be visible on each axis.
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

// How long stepBy keeps dropping steps for one pending seek. After this the
// seek is considered stuck and stepping is allowed again (each retry re-arms
// the window, so a dead network degrades to one step per window, not a lock).
export const FRAME_STEP_ESCAPE_MS = 2000;

export const viewport = new Viewport();

export const VIEWPORT_MIN_ZOOM = 0.05;
export const VIEWPORT_MAX_ZOOM = 100;
