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
    // displayedFrame lags currentFrame until video confirms seek. Prevents annotations jumping ahead of pixels.
    displayedFrame: { value: 0 },
    // Consolidated loading state (read by LoadingIndicator.svelte).
    // highQuality: HLS high-quality fragment downloading.
    // qualityLabel: quality level label.
    // fragmentInFlight: paint-path fragment downloading; blocks stepBy escape window to prevent mid-download cancellation.
    // buffering: playback stalled on next fragment(s). Drives "Loading Frame" pill while playing.
    // framePending: currentFrame ≠ displayedFrame (seek in flight).
    loading: {
      highQuality: false,
      qualityLabel: "",
      fragmentInFlight: false,
      buffering: false,
    },
    get framePending() {
      return this.status == "pause" && this.currentFrame.value !== this.displayedFrame.value;
    },
    status: "pause" as "play" | "pause",
    // Set when navigation pauses active playback. Tells Video.svelte's play/pause $effect to skip syncPausedFrame() and let seek $effect drive to target.
    pauseForSeek: false,
    sound: { level: 0.0, muted: true },
    // Tracks when pending seek last progressed. Re-armed on each paint-path fragment transition.
    // stepBy uses it to differentiate progressing seeks (block steps) from stuck ones (allow retry).
    lastSeekRequestAt: 0,
    // Re-arm stuck-seek escape on every paint-path transition to prevent key-repeats landing mid-fragment.
    setFragmentInFlight(inFlight: boolean) {
      this.loading.fragmentInFlight = inFlight;
      this.lastSeekRequestAt = Date.now();
    },
    play() {
      this.status = "play";
    },
    pause() {
      this.status = "pause";
    },
    goToFrame(frame: number) {
      // Auto-pause active playback so user can land on any frame (RAF loop won't overwrite currentFrame).
      if (this.status === "play") {
        this.pauseForSeek = true;
        this.status = "pause";
      }
      // Clamp to valid range so framePending (currentFrame ≠ displayedFrame) doesn't latch out-of-range values.
      const total = media.totalFrames;
      const max = total > 0 ? total - 1 : frame;
      const next = Math.max(0, Math.min(frame, max));
      if (next !== this.currentFrame.value) this.lastSeekRequestAt = Date.now();
      this.currentFrame.value = next;
    },
    // Relative stepping (arrow keys, skip buttons). Drop steps while previous paused seek hasn't painted—avoid buffered jumps.
    // Buffered seeks confirm ~one vsync, so gate is imperceptible. Escape window unlocks stuck seeks (network died mid-load).
    // Absolute jumps (goToFrame) bypass gate. Don't block background HQ downloads or leak escape mid-fragment.
    stepBy(delta: number) {
      if (
        this.framePending &&
        (this.loading.fragmentInFlight || Date.now() - this.lastSeekRequestAt < FRAME_STEP_ESCAPE_MS)
      ) {
        return;
      }
      this.goToFrame(this.currentFrame.value + delta);
    },
  });

  workspace = $state({
    transform: {
      translate: [0, 0] as [number, number],
      scale: 1.0,
    },
    dimensions: [0, 0] as [number, number],

    // Fit video to viewport maintaining aspect ratio. Call on dimension change.
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

    // Clamp translation so video never fully leaves viewport (20px margin). Call after translate/scale change.
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

// How long stepBy drops steps for one pending seek. After this, seek is considered stuck and stepping resumes.
export const FRAME_STEP_ESCAPE_MS = 2000;

export const VIEWPORT_MIN_ZOOM = 0.05;
export const VIEWPORT_MAX_ZOOM = 100;
