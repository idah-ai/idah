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
    //   fragmentInFlight — mirrored from the HLS layer: a fragment a pending
    //     seek may be waiting on (the non-HQ paint path) is downloading right
    //     now. stepBy reads it so the escape window can't open mid-download
    //     and cancel a slow fragment (the 3G livelock). Background HQ work
    //     (upgrades, buffer filling) never sets it — it must not block
    //     navigation, and cancelling it is always safe.
    //   buffering — playback stalled waiting for the next fragment(s) to
    //     download. Drives the "Loading Frame" pill while playing (the paused
    //     case is covered by framePending instead, since the two never differ
    //     during playback). Wired from the video element's waiting/playing
    //     events in Video.svelte.
    //   framePending — true when currentFrame ≠ displayedFrame (seek in flight).
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
    sound: { level: 0.0, muted: true },
    // When the pending seek last showed signs of life: set on every
    // position-changing navigation and re-armed by every paint-path fragment
    // transition (setFragmentInFlight). stepBy uses it to tell a seek that
    // is still progressing (block further steps) from one that is stuck
    // (let the user move again).
    lastSeekRequestAt: 0,
    // Mirror of the HLS paint-path download state (wired in Video.svelte).
    // Any transition counts as seek progress and re-arms the stuck-seek
    // escape window: the flag is momentarily false between consecutive
    // fragments (download done → append → paint, or → next fragment
    // request), and without the re-arm a key-repeat landing in that gap
    // would be accepted — jumping currentFrame onto a new fragment and
    // discarding the one that just finished, so the video pixels would
    // never advance.
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
    // mid-load) must not lock navigation. The escape only fires when no
    // paint-path fragment is downloading: an escaped step re-runs the
    // quality logic, which stops and restarts the loader — on a connection
    // where every fragment takes longer than the window, escaping
    // mid-download would cancel and re-request the same fragment forever and
    // the pending frame would never paint. Background HQ downloads don't set
    // the flag (see loading.fragmentInFlight above), and a dead network
    // drops it via error/timeout events, so the stuck-seek escape still
    // opens in both cases.
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
