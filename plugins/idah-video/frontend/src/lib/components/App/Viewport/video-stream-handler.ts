import Hls from "hls.js";

interface QualityInfo {
  height: number;
  width: number;
  label: string;
}

interface VideoStreamHandlerOptions {
  // Authoritative last-frame timestamp from database metadata. Used instead of
  // videoElement.duration when ended, which can differ from the real last fragment.
  endOfFrameTime?: number;
  initialFragmentCount?: number;
  onLoadingChange?: (loading: boolean, qualityInfo?: QualityInfo) => void;
}

// One in-flight "load level N at time T, then repaint" operation.
//   fragListener — FRAG_LOADED listener awaiting the target fragment(s).
//   settleTimer  — append-settle delay before nudging currentTime.
//   timeoutTimer — safety fallback that tears the render down if the awaited
//                  fragment(s) never arrive (e.g. already buffered so hls.js
//                  emits no FRAG_LOADED), so the loader can never hang on.
//   loaderShown  — whether onLoadingChange(true) was emitted for this render
//                  (so cancellation knows whether to emit onLoadingChange(false)).
interface PendingRender {
  fragListener: (event: string, data: any) => void;
  settleTimer: ReturnType<typeof setTimeout> | null;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
  loaderShown: boolean;
}

// Wait this long after FRAG_LOADED for the SourceBuffer append to complete
// before nudging currentTime to repaint.
const SETTLE_MS = 50;
// Debounce after the last navigation seek before upgrading the frame to HQ.
const UPGRADE_DEBOUNCE_MS = 300;
// Switch to ABR this long after playback starts and stays stable.
const PLAYBACK_ABR_DELAY_MS = 3000;
// renderLevelAt inactivity watchdog: abandon a render only after this long with
// no fragment in flight (so the loader can't hang when the required FRAG_LOADED
// never fires). It re-arms while a fragment is downloading, so a slow HQ load
// that takes longer than this is never cut off.
const RENDER_TIMEOUT_MS = 15000;

/**
 * Manages HLS adaptive streaming for a paused-frame annotation workflow.
 *
 * The job is small: while the annotator navigates frames (paused, rapid
 * seeking) show the LOWEST quality so frames appear instantly; once they stop
 * on a frame, upgrade it to the HIGHEST quality. Playback uses HLS ABR.
 *
 * It is built from one reusable primitive, renderLevelAt(level, time):
 *   - point HLS at `level`, load around `time`, wait for the fragment(s),
 *     then nudge currentTime to flush the decoder and paint the new quality.
 *
 * Navigation (loadQuality) renders level 0 immediately, then schedules an HQ
 * upgrade UPGRADE_DEBOUNCE_MS after the last seek. Pause/initial-load upgrade
 * immediately.
 */
export class VideoStreamHandler {
  private videoElement: HTMLVideoElement;
  private sourceUrl: string;
  private hls: Hls | null = null;

  private maxQualityLevel = -1;
  private fragmentsLoaded = 0;
  private isInitialLoad = true;
  private isPaused = true;

  // True while hls.js has a fragment request in flight (between FRAG_LOADING and
  // FRAG_LOADED/error). The renderLevelAt watchdog uses this to distinguish a
  // genuinely stuck render (nothing downloading) from a slow-but-progressing one.
  private fragLoadInFlight = false;

  private endOfFrameTime: number;
  private initialFragmentCount: number;
  private onLoadingChange: (loading: boolean, qualityInfo?: QualityInfo) => void;

  // The single in-flight render. Only one exists at a time; starting a new one
  // (or cancelling) clears the previous.
  private pendingRender: PendingRender | null = null;

  // Debounce timer that fires upgradeToHQ() after navigation stops.
  private upgradeTimer: ReturnType<typeof setTimeout> | null = null;

  // Deferred ABR switch during playback.
  private adaptiveTransitionTimer: ReturnType<typeof setTimeout> | null = null;

  // DOM event references stored for clean removal on destroy.
  private boundPlayHandler: (() => void) | null = null;
  private boundPauseHandler: (() => void) | null = null;

  constructor(videoElement: HTMLVideoElement, sourceUrl: string, options: VideoStreamHandlerOptions = {}) {
    this.videoElement = videoElement;
    this.sourceUrl = sourceUrl;
    this.endOfFrameTime = options.endOfFrameTime ?? 0.1;
    this.initialFragmentCount = options.initialFragmentCount ?? 1;
    this.onLoadingChange = options.onLoadingChange ?? (() => {});
    this.init();
  }

  // ── Init ──────────────────────────────────────────────────────────

  private init(): void {
    if (!Hls.isSupported()) {
      if (this.videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        this.videoElement.src = this.sourceUrl;
      }
      return;
    }

    // A generous buffer window keeps level-0 fragments around the playhead so
    // most navigation seeks land in already-buffered territory.
    this.hls = new Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 30,
      autoStartLoad: false,
      debug: false,
    });
    this.hls.loadSource(this.sourceUrl);
    this.hls.attachMedia(this.videoElement);
    this.setupEventListeners();
    this.hls.startLoad(0);
  }

  // ── Event listeners ───────────────────────────────────────────────

  private setupEventListeners(): void {
    if (!this.hls) return;

    // Record quality levels; start at LQ so the first frames appear fast.
    this.hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      this.maxQualityLevel = data.levels.length - 1;
      if (this.hls) this.hls.currentLevel = 0;
    });

    // Track in-flight fragment requests so the render watchdog can tell a slow
    // download apart from a truly stalled one.
    this.hls.on(Hls.Events.FRAG_LOADING, () => {
      this.fragLoadInFlight = true;
    });

    // After the initial LQ burst, stop loading and immediately upgrade the
    // first frame to HQ so the annotator sees full quality from the start.
    this.hls.on(Hls.Events.FRAG_LOADED, () => {
      this.fragLoadInFlight = false;
      this.fragmentsLoaded++;
      if (this.isInitialLoad && this.fragmentsLoaded >= this.initialFragmentCount) {
        this.hls?.stopLoad();
        this.isInitialLoad = false;
        if (this.maxQualityLevel > 0) this.upgradeToHQ(this.seekTime());
      }
    });

    this.boundPlayHandler = () => {
      this.isPaused = false;
      this.isInitialLoad = false;
      this.cancelPendingRender();
      if (!this.hls) return;
      this.hls.startLoad(this.seekTime());
      // Switch to ABR after a few seconds of stable playback.
      this.adaptiveTransitionTimer = setTimeout(() => {
        this.adaptiveTransitionTimer = null;
        if (this.hls && !this.videoElement.paused) this.hls.currentLevel = -1;
      }, PLAYBACK_ABR_DELAY_MS);
    };
    this.videoElement.addEventListener("play", this.boundPlayHandler);

    // On pause (from play or natural end): bypass the debounce and upgrade
    // to HQ immediately so the settled frame is always full quality.
    this.boundPauseHandler = () => {
      this.cancelAdaptiveTransition();
      this.isPaused = true;
      if (this.maxQualityLevel < 0 || !this.hls) return;
      this.upgradeToHQ(this.seekTime());
    };
    this.videoElement.addEventListener("pause", this.boundPauseHandler);

    this.hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.frag) this.fragLoadInFlight = false;
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) this.hls?.startLoad();
      else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) this.hls?.recoverMediaError();
      else this.destroy();
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private seekTime(): number {
    return this.videoElement.ended ? this.endOfFrameTime : this.videoElement.currentTime;
  }

  private isBufferedAt(t: number): boolean {
    const b = this.videoElement.buffered;
    for (let i = 0; i < b.length; i++) {
      if (b.start(i) <= t + 0.1 && t <= b.end(i) + 0.1) return true;
    }
    return false;
  }

  private getQualityInfo(level: number): QualityInfo | undefined {
    if (level === -1) return { height: 0, width: 0, label: "Auto" };
    if (!this.hls || level < 0 || level >= this.hls.levels.length) return undefined;
    const { height, width } = this.hls.levels[level];
    return { height, width, label: `${height}p` };
  }

  private cancelAdaptiveTransition(): void {
    if (this.adaptiveTransitionTimer !== null) {
      clearTimeout(this.adaptiveTransitionTimer);
      this.adaptiveTransitionTimer = null;
    }
  }

  private cancelUpgradeTimer(): void {
    if (this.upgradeTimer !== null) {
      clearTimeout(this.upgradeTimer);
      this.upgradeTimer = null;
    }
  }

  // Tear down the in-flight render: detach its listener, clear its settle
  // timer, and hide the loader if it had been shown for this render.
  private clearPendingRender(): void {
    if (!this.pendingRender) return;
    const { fragListener, settleTimer, timeoutTimer, loaderShown } = this.pendingRender;
    if (this.hls) this.hls.off(Hls.Events.FRAG_LOADED, fragListener);
    if (settleTimer !== null) clearTimeout(settleTimer);
    if (timeoutTimer !== null) clearTimeout(timeoutTimer);
    this.pendingRender = null;
    if (loaderShown) this.onLoadingChange(false);
  }

  // ── Core primitive ────────────────────────────────────────────────

  // Load `level` at `time`, wait for enough fragments, then flush the decoder
  // with a same-value seek so the new quality paints. `showLoader` toggles the
  // loading indicator (used for HQ upgrades, not for instant LQ navigation).
  private renderLevelAt(level: number, time: number, showLoader: boolean): void {
    if (!this.hls) return;
    this.clearPendingRender();

    const loaderShown = showLoader && this.hls.currentLevel !== level;
    this.hls.currentLevel = level;
    if (loaderShown) this.onLoadingChange(true, this.getQualityInfo(level));

    this.hls.startLoad(time);

    // Need 2 fragments to safely span a mid-fragment seek, but only 1 when the
    // target is inside the final fragment (there is no "next" to wait for).
    const frags = this.hls.levels[level]?.details?.fragments ?? [];
    const lastFrag = frags[frags.length - 1];
    const requiredCount = lastFrag && time >= lastFrag.start ? 1 : 2;
    let loaded = 0;

    const fragListener = (_event: string, data: any) => {
      if (data.frag.level !== level) return;
      if (++loaded < requiredCount) return;
      this.hls?.off(Hls.Events.FRAG_LOADED, fragListener);

      const settleTimer = setTimeout(() => {
        if (this.pendingRender?.timeoutTimer) clearTimeout(this.pendingRender.timeoutTimer);
        this.pendingRender = null;
        if (this.videoElement.paused && this.isBufferedAt(time)) {
          this.videoElement.currentTime = time;
        }
        if (loaderShown) this.onLoadingChange(false);
      }, SETTLE_MS);

      if (this.pendingRender) this.pendingRender.settleTimer = settleTimer;
    };

    // Safety net for the "already buffered, so hls.js emits no FRAG_LOADED"
    // case where the required fragments never arrive and the loader would hang.
    // This is an *inactivity* watchdog, not an absolute deadline: as long as a
    // fragment is actually downloading (fragLoadInFlight) it re-arms, so a
    // legitimately slow HQ load — which can exceed RENDER_TIMEOUT_MS on poor
    // connections — is never cut off. It only tears the render down when nothing
    // is in flight and the required fragments still haven't landed.
    const armWatchdog = (): ReturnType<typeof setTimeout> =>
      setTimeout(() => {
        if (this.fragLoadInFlight) {
          if (this.pendingRender) this.pendingRender.timeoutTimer = armWatchdog();
          return;
        }
        this.clearPendingRender();
      }, RENDER_TIMEOUT_MS);

    this.pendingRender = { fragListener, settleTimer: null, timeoutTimer: armWatchdog(), loaderShown };
    this.hls.on(Hls.Events.FRAG_LOADED, fragListener);
  }

  // ── Quality upgrade ───────────────────────────────────────────────

  // Upgrade the frame at `time` to max quality — but only once the LQ fragment
  // for that position is confirmed in the SourceBuffer.
  //
  // On fast networks LQ is already buffered, so this renders HQ immediately.
  // On slow networks LQ may still be downloading; flushing to HQ now would drop
  // the unbuffered LQ frame and show nothing until HQ arrives (potentially 10+ s).
  // So we wait for the level-0 fragment to land, keeping the LQ frame on screen,
  // then flush to HQ.
  private upgradeToHQ(time: number): void {
    this.cancelUpgradeTimer();
    if (!this.hls || !this.isPaused || this.maxQualityLevel <= 0) return;

    if (this.isBufferedAt(time)) {
      this.renderLevelAt(this.maxQualityLevel, time, true);
      return;
    }

    // LQ not buffered yet — wait for the level-0 fragment. No loader is shown
    // in this phase (the LQ frame should appear without an HQ indicator). Each
    // level-0 FRAG_LOADED resets a settle check; only once `time` is actually
    // buffered do we hand off to the HQ render.
    this.clearPendingRender();
    const fragListener = (_event: string, data: any) => {
      if (data.frag.level !== 0) return;
      if (this.pendingRender?.settleTimer) clearTimeout(this.pendingRender.settleTimer);
      const settleTimer = setTimeout(() => {
        if (!this.isPaused || !this.hls) return;
        if (!this.isBufferedAt(time)) return; // not our fragment yet — keep listening
        // Do NOT null pendingRender here: renderLevelAt() begins with
        // clearPendingRender(), which is the only path that detaches this
        // listener from FRAG_LOADED. Clearing the pointer first would make that
        // early-return and leak this listener.
        this.renderLevelAt(this.maxQualityLevel, time, true);
      }, SETTLE_MS);
      if (this.pendingRender) this.pendingRender.settleTimer = settleTimer;
    };

    this.pendingRender = { fragListener, settleTimer: null, timeoutTimer: null, loaderShown: false };
    this.hls.on(Hls.Events.FRAG_LOADED, fragListener);
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Single entry point for all paused seeks.
   *
   * Renders LQ at `time` immediately so the frame appears as fast as possible,
   * then schedules an upgrade to the highest available quality. Every new call
   * resets the upgrade timer, so rapid navigation (arrow-key hold) stays at LQ
   * until the user stops.
   */
  public loadQuality(time: number): void {
    if (!this.hls || this.maxQualityLevel < 0) return;

    this.cancelPendingRender();

    // LQ phase — instant, no loader. The caller (Video.svelte seek effect)
    // already set currentTime, so a buffered frame is already painting and
    // there is nothing to do; only load+repaint when it isn't buffered yet.
    if (!this.isBufferedAt(time)) {
      this.renderLevelAt(0, time, false);
    }

    // HQ phase — fires UPGRADE_DEBOUNCE_MS after the last call with no further
    // navigation.
    this.upgradeTimer = setTimeout(() => {
      this.upgradeTimer = null;
      this.upgradeToHQ(time);
    }, UPGRADE_DEBOUNCE_MS);
  }

  public cancelPendingRender(): void {
    this.cancelUpgradeTimer();
    this.clearPendingRender();
    this.cancelAdaptiveTransition();
  }

  public destroy(): void {
    this.cancelPendingRender();
    if (this.boundPlayHandler) {
      this.videoElement.removeEventListener("play", this.boundPlayHandler);
      this.boundPlayHandler = null;
    }
    if (this.boundPauseHandler) {
      this.videoElement.removeEventListener("pause", this.boundPauseHandler);
      this.boundPauseHandler = null;
    }
    this.hls?.destroy();
    this.hls = null;
  }

  public setInitialFragmentCount(count: number): void {
    this.initialFragmentCount = count;
  }

  public getCurrentQualityLevel(): number {
    return this.hls?.currentLevel ?? -1;
  }

  public setQualityLevel(level: number): void {
    if (!this.hls || this.hls.currentLevel === level) return;
    if (this.isPaused && level !== -1) {
      this.renderLevelAt(level, this.seekTime(), true);
    } else {
      this.hls.currentLevel = level;
    }
  }
}
