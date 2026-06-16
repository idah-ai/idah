import Hls from "hls.js";

interface QualityInfo {
  height: number;
  width: number;
  label: string;
}

interface VideoStreamHandlerOptions {
  endOfFrameTime?: number;
  initialFragmentCount?: number;
  // Slow-network budget: max ms to wait for one HQ fragment before falling back to LQ
  slowNetworkThresholdMs?: number;
  onLoadingChange?: (loading: boolean, qualityInfo?: QualityInfo) => void;
  // Gate for arrow-key stepping: true while a paint-path fragment is downloading
  // (LQ fallback or single-level stream). Background HQ work doesn't gate.
  onFragmentInFlightChange?: (inFlight: boolean) => void;
}

interface TimeRange {
  start: number;
  end: number;
}

// In-flight HQ upgrade or LQ-fallback handoff operation
interface PendingRender {
  fragListener: (event: string, data: any) => void; // Awaits coverage via FRAG_BUFFERED
  settleTimer: ReturnType<typeof setTimeout> | null; // Delay before repainting
  timeoutTimer: ReturnType<typeof setTimeout> | null; // 15s watchdog against hangs
  loaderShown: boolean; // Whether to emit onLoadingChange(false) on cancel
}

const SETTLE_MS = 50; // Delay before repainting after coverage is met
const RENDER_COVERAGE_S = 0.5; // Forward buffer ahead of frame needed for smooth decode
const UPGRADE_DEBOUNCE_MS = 300; // Delay before upgrading LQ to HQ after navigation stops
const PLAYBACK_ABR_DELAY_MS = 3000; // Handoff to ABR after playback stabilizes
const RENDER_TIMEOUT_MS = 15000; // Watchdog: abandon stuck upgrade with no downloads
const RANGE_TOLERANCE_S = 0.1; // Slack when comparing time against buffered ranges
const SLOW_NETWORK_THRESHOLD_MS = 1000; // Budget for HQ fragment on slow networks

/**
 * HLS stream manager for frame-accurate annotation playback.
 *
 * Strategy: Start low-quality, switch to high-quality permanently. On slow
 * networks, use predict-then-verify to decide HQ vs. LQ upfront. Surgical
 * buffer flushes replace only LQ regions with HQ when user settles.
 *
 * Uses `hls.loadLevel` (non-destructive) not `currentLevel` (flushes buffer).
 * Stream controller auto-follows seeking; unbuffered seeks load at HQ (or LQ
 * if slow) without manual intervention.
 */
export class VideoStreamHandler {
  private videoElement: HTMLVideoElement;
  private sourceUrl: string;
  private hls: Hls | null = null;

  private maxQualityLevel = -1;
  private fragmentsLoaded = 0;
  private isInitialLoad = true;
  private isPaused = true;

  private fragLoadInFlight = false; // Fragment download in progress
  private gatingFragInFlight = false; // Non-HQ paint-path fragment in progress (gates stepping)
  private inFlightFrag: TimeRange & { level: number } | null = null; // Current download window
  private hqDeadlineMissed = false; // HQ missed deadline; skip it next time until recovery

  private endOfFrameTime: number;
  private initialFragmentCount: number;
  private slowNetworkThresholdMs: number;
  private onLoadingChange: (loading: boolean, qualityInfo?: QualityInfo) => void;
  private onFragmentInFlightChange: (inFlight: boolean) => void;

  private lqRanges: TimeRange[] = []; // Tracks which buffer regions hold LQ data
  private pendingRender: PendingRender | null = null; // Single in-flight upgrade/fallback
  private upgradeTimer: ReturnType<typeof setTimeout> | null = null; // Debounce before upgrading LQ
  private hqDeadlineTimer: ReturnType<typeof setTimeout> | null = null; // Fallback to LQ if HQ takes too long
  private adaptiveTransitionTimer: ReturnType<typeof setTimeout> | null = null; // Switch to ABR during playback

  // DOM event references stored for clean removal on destroy.
  private boundPlayHandler: (() => void) | null = null;
  private boundPauseHandler: (() => void) | null = null;

  constructor(videoElement: HTMLVideoElement, sourceUrl: string, options: VideoStreamHandlerOptions = {}) {
    this.videoElement = videoElement;
    this.sourceUrl = sourceUrl;
    this.endOfFrameTime = options.endOfFrameTime ?? 0.1;
    this.initialFragmentCount = options.initialFragmentCount ?? 1;
    this.slowNetworkThresholdMs = options.slowNetworkThresholdMs ?? SLOW_NETWORK_THRESHOLD_MS;
    this.onLoadingChange = options.onLoadingChange ?? (() => {});
    this.onFragmentInFlightChange = options.onFragmentInFlightChange ?? (() => {});
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

    // A generous buffer window keeps HQ fragments around the playhead so
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

    // Start initial burst at LQ; use loadLevel (no buffer flush)
    this.hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      this.maxQualityLevel = data.levels.length - 1;
      if (this.hls) this.hls.loadLevel = 0;
    });

    // Track fragment downloads for watchdog
    this.hls.on(Hls.Events.FRAG_LOADING, (_event, data) => {
      this.setFragLoadInFlight(true, data.frag);
    });

    // Maintain LQ range map on append
    this.hls.on(Hls.Events.FRAG_BUFFERED, (_event, data) => {
      const frag = data.frag;
      if (frag.type !== "main") return;
      const start = frag.start;
      const end = frag.start + frag.duration;
      if (frag.level === this.maxQualityLevel) this.subtractLQRange(start, end);
      else this.addLQRange(start, end);
    });

    // After initial burst: pin to HQ and replace burst region
    this.hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
      this.setFragLoadInFlight(false);
      if (data.frag.level === this.maxQualityLevel) this.hqDeadlineMissed = false;
      this.fragmentsLoaded++;
      if (this.isInitialLoad && this.fragmentsLoaded >= this.initialFragmentCount) {
        this.isInitialLoad = false;
        if (this.hls && this.maxQualityLevel > 0) {
          this.hls.loadLevel = this.maxQualityLevel;
          this.renderHQAt(this.seekTime());
        }
      }
    });

    this.boundPlayHandler = () => {
      this.isPaused = false;
      this.isInitialLoad = false;
      this.cancelPendingRender();
      if (!this.hls) return;
      this.hls.startLoad(this.seekTime());
      // Hand to ABR after playback stabilizes (no flush, non-HQ will upgrade on next pause)
      this.adaptiveTransitionTimer = setTimeout(() => {
        this.adaptiveTransitionTimer = null;
        if (this.hls && !this.videoElement.paused) {
          this.hls.loadLevel = -1;
        }
      }, PLAYBACK_ABR_DELAY_MS);
    };
    this.videoElement.addEventListener("play", this.boundPlayHandler);

    // On pause: re-pin to HQ, upgrade current frame immediately
    this.boundPauseHandler = () => {
      this.cancelTimer("adaptiveTransitionTimer");
      this.isPaused = true;
      if (this.maxQualityLevel < 0 || !this.hls) return;
      this.hls.loadLevel = this.maxQualityLevel;
      this.upgradeToHQ(this.seekTime());
    };
    this.videoElement.addEventListener("pause", this.boundPauseHandler);

    this.hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.frag) this.setFragLoadInFlight(false);
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

  // Gate stepping on paint-path fragments (non-HQ or single-level only)
  private setFragLoadInFlight(
    inFlight: boolean,
    frag?: { type: string; level: number; start: number; duration: number },
  ): void {
    this.fragLoadInFlight = inFlight;
    this.inFlightFrag =
      inFlight && frag ? { start: frag.start, end: frag.start + frag.duration, level: frag.level } : null;
    const gating =
      inFlight && frag?.type === "main" && (frag.level !== this.maxQualityLevel || this.maxQualityLevel <= 0);
    if (gating === this.gatingFragInFlight) return;
    this.gatingFragInFlight = gating;
    this.onFragmentInFlightChange(gating);
  }

  private isBufferedAt(t: number): boolean {
    const b = this.videoElement.buffered;
    for (let i = 0; i < b.length; i++) {
      if (b.start(i) <= t + RANGE_TOLERANCE_S && t <= b.end(i) + RANGE_TOLERANCE_S) return true;
    }
    return false;
  }

  private bufferedRangeContaining(t: number): TimeRange | null {
    const b = this.videoElement.buffered;
    for (let i = 0; i < b.length; i++) {
      if (b.start(i) <= t + RANGE_TOLERANCE_S && t <= b.end(i) + RANGE_TOLERANCE_S) {
        return { start: b.start(i), end: b.end(i) };
      }
    }
    return null;
  }

  private getQualityInfo(level: number): QualityInfo | undefined {
    if (level === -1) return { height: 0, width: 0, label: "Auto" };
    if (!this.hls || level < 0 || level >= this.hls.levels.length) return undefined;
    const { height, width } = this.hls.levels[level];
    return { height, width, label: `${height}p` };
  }

  private cancelTimer(key: "upgradeTimer" | "hqDeadlineTimer" | "adaptiveTransitionTimer"): void {
    if (this[key] !== null) {
      clearTimeout(this[key]!);
      this[key] = null;
    }
  }

  // Tear down the in-flight render: unregister its listener, clear its timers,
  // and hide the loader if it had been shown for this render.
  private clearPendingRender(): void {
    if (!this.pendingRender) return;
    const { fragListener, settleTimer, timeoutTimer, loaderShown } = this.pendingRender;
    this.hls?.off(Hls.Events.FRAG_BUFFERED, fragListener);
    if (settleTimer !== null) clearTimeout(settleTimer);
    if (timeoutTimer !== null) clearTimeout(timeoutTimer);
    this.pendingRender = null;
    if (loaderShown) this.onLoadingChange(false);
  }

  // ── LQ range map ──────────────────────────────────────────────────

  private addLQRange(start: number, end: number): void {
    const merged: TimeRange[] = [];
    let s = start;
    let e = end;
    for (const r of this.lqRanges) {
      if (r.end < s - RANGE_TOLERANCE_S || r.start > e + RANGE_TOLERANCE_S) {
        merged.push(r);
      } else {
        s = Math.min(s, r.start);
        e = Math.max(e, r.end);
      }
    }
    merged.push({ start: s, end: e });
    merged.sort((a, b) => a.start - b.start);
    this.lqRanges = merged;
  }

  private subtractLQRange(start: number, end: number): void {
    const next: TimeRange[] = [];
    for (const r of this.lqRanges) {
      if (r.end <= start || r.start >= end) {
        next.push(r);
        continue;
      }
      if (r.start < start) next.push({ start: r.start, end: start });
      if (r.end > end) next.push({ start: end, end: r.end });
    }
    this.lqRanges = next;
  }

  // Remove ranges evicted from buffer (lazy cleanup before lookups)
  private pruneLQRanges(): void {
    const b = this.videoElement.buffered;
    this.lqRanges = this.lqRanges.filter((r) => {
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) < r.end && r.start < b.end(i)) return true;
      }
      return false;
    });
  }

  private lqRangeAt(time: number): TimeRange | null {
    this.pruneLQRanges();
    return this.lqRanges.find((r) => time >= r.start - RANGE_TOLERANCE_S && time <= r.end + RANGE_TOLERANCE_S) ?? null;
  }

  // Estimated seconds to download one HQ fragment at measured bandwidth
  private estimateHQFragmentSeconds(): number | null {
    if (!this.hls || this.maxQualityLevel <= 0) return null;
    const level = this.hls.levels[this.maxQualityLevel];
    if (!level || !level.bitrate) return null;
    const details = level.details ?? this.hls.levels.find((l) => l.details)?.details;
    const fragDuration = details?.averagetargetduration ?? details?.targetduration;
    const bandwidth = this.hls.bandwidthEstimate;
    if (!fragDuration || !bandwidth || !Number.isFinite(bandwidth)) return null;
    return (level.bitrate * fragDuration) / bandwidth;
  }

  // ── Core primitive ────────────────────────────────────────────────

  // Replace LQ data at `time` with HQ, flush decoder to repaint
  private renderHQAt(time: number): void {
    if (!this.hls) return;
    this.clearPendingRender();

    const level = this.maxQualityLevel;
    this.onLoadingChange(true, this.getQualityInfo(level));

    // Stop loader before flush; manual in-flight reset (FRAG_LOADED won't fire)
    this.hls.stopLoad();
    this.setFragLoadInFlight(false);

    const range = this.bufferedRangeContaining(time);
    let toFlush = range ? this.lqRanges.filter((r) => r.start < range.end && range.start < r.end) : [];
    // Map can lag reality; if data buffered but untracked, flush whole range
    if (range && !toFlush.some((r) => time >= r.start - RANGE_TOLERANCE_S && time <= r.end + RANGE_TOLERANCE_S)) {
      toFlush = [range];
    }
    for (const r of toFlush) {
      this.hls.trigger(Hls.Events.BUFFER_FLUSHING, { startOffset: r.start, endOffset: r.end, type: null });
      this.subtractLQRange(r.start, r.end);
    }

    // Re-pin to HQ; slow-network fallback may have left loader on LQ
    this.hls.loadLevel = level;
    this.hls.startLoad(time);

    // Wait for coverage (not load count) — append may lag download
    const fragListener = (_event: string, data: any) => {
      if (data.frag.level !== level || data.frag.type !== "main") return;
      const range = this.bufferedRangeContaining(time);
      if (!range) return; // the fragment covering `time` hasn't appended yet
      const frags = this.hls?.levels[level]?.details?.fragments ?? [];
      const lastFrag = frags[frags.length - 1];
      const streamEnd = lastFrag ? lastFrag.start + lastFrag.duration : time;
      if (range.end + RANGE_TOLERANCE_S < Math.min(time + RENDER_COVERAGE_S, streamEnd)) return;
      this.hls?.off(Hls.Events.FRAG_BUFFERED, fragListener);

      const settleTimer = setTimeout(() => {
        if (this.pendingRender?.timeoutTimer) clearTimeout(this.pendingRender.timeoutTimer);
        this.pendingRender = null;
        if (this.videoElement.paused && this.isBufferedAt(time)) {
          this.videoElement.currentTime = time;
        }
        this.onLoadingChange(false);
      }, SETTLE_MS);

      if (this.pendingRender) this.pendingRender.settleTimer = settleTimer;
    };

    // Re-arming watchdog: abandon only if nothing downloading for 15s
    const armWatchdog = (): ReturnType<typeof setTimeout> =>
      setTimeout(() => {
        if (this.fragLoadInFlight) {
          if (this.pendingRender) this.pendingRender.timeoutTimer = armWatchdog();
          return;
        }
        this.clearPendingRender();
      }, RENDER_TIMEOUT_MS);

    this.pendingRender = {
      fragListener,
      settleTimer: null,
      timeoutTimer: armWatchdog(),
      loaderShown: true,
    };
    this.hls.on(Hls.Events.FRAG_BUFFERED, fragListener);
  }

  // ── Slow-network fallback ─────────────────────────────────────────

  // Paint LQ first on slow networks, then schedule HQ upgrade
  private renderLQFallbackAt(time: number): void {
    if (!this.hls) return;
    this.clearPendingRender();

    this.hls.loadLevel = 0;
    // Keep in-flight LQ fragment if it covers time (retarget, don't restart)
    const f = this.inFlightFrag;
    const coversTarget =
      this.fragLoadInFlight &&
      f !== null &&
      f.level === 0 &&
      time >= f.start - RANGE_TOLERANCE_S &&
      time <= f.end + RANGE_TOLERANCE_S;
    if (!coversTarget) {
      this.hls.stopLoad();
      this.setFragLoadInFlight(false);
      this.hls.startLoad(time);
    }

    // Wait for coverage (append landed), then schedule HQ upgrade
    const fragListener = (_event: string, data: any) => {
      if (data.frag.level !== 0 || data.frag.type !== "main") return;
      const range = this.bufferedRangeContaining(time);
      if (!range) return; // a different fragment — keep listening
      const frags = this.hls?.levels[0]?.details?.fragments ?? [];
      const lastFrag = frags[frags.length - 1];
      const streamEnd = lastFrag ? lastFrag.start + lastFrag.duration : time;
      if (range.end + RANGE_TOLERANCE_S < Math.min(time + RENDER_COVERAGE_S, streamEnd)) return;
      this.clearPendingRender();
      if (!this.isPaused) return;
      this.upgradeTimer = setTimeout(() => {
        this.upgradeTimer = null;
        this.upgradeToHQ(time);
      }, UPGRADE_DEBOUNCE_MS);
    };

    this.pendingRender = {
      fragListener,
      settleTimer: null,
      timeoutTimer: null,
      loaderShown: false,
    };
    this.hls.on(Hls.Events.FRAG_BUFFERED, fragListener);
  }

  // ── Quality upgrade ───────────────────────────────────────────────

  // Upgrade frame to HQ if it's on tracked LQ data
  private upgradeToHQ(time: number): void {
    this.cancelTimer("upgradeTimer");
    if (!this.hls || !this.isPaused || this.maxQualityLevel <= 0) return;
    if (this.videoElement.seeking) return; // Don't flush while seek pending
    if (!this.lqRangeAt(time)) return;
    this.renderHQAt(time);
  }

  // ── Public API ────────────────────────────────────────────────────

  // Main entry point for all paused seeks
  public loadQuality(time: number): void {
    if (!this.hls || this.maxQualityLevel < 0) return;
    this.cancelPendingRender();

    // Unbuffered: predict HQ feasibility
    if (!this.isBufferedAt(time)) {
      const estimate = this.estimateHQFragmentSeconds();
      const predictedSlow = estimate !== null && estimate * 1000 > this.slowNetworkThresholdMs;
      if (predictedSlow || this.hqDeadlineMissed) {
        this.renderLQFallbackAt(time);
        return;
      }
      if (this.hls.loadLevel !== this.maxQualityLevel) {
        this.hls.loadLevel = this.maxQualityLevel;
      }
      // Verify prediction with deadline; fallback to LQ if HQ takes too long
      this.hqDeadlineTimer = setTimeout(() => {
        this.hqDeadlineTimer = null;
        if (!this.isPaused || !this.hls) return;
        if (this.isBufferedAt(time)) return;
        this.hqDeadlineMissed = true;
        this.renderLQFallbackAt(time);
      }, this.slowNetworkThresholdMs);
      return;
    }

    // Buffered and clean: already HQ
    if (!this.lqRangeAt(time)) return;

    // Buffered but LQ: upgrade after navigation rests (debounced)
    this.upgradeTimer = setTimeout(() => {
      this.upgradeTimer = null;
      this.upgradeToHQ(time);
    }, UPGRADE_DEBOUNCE_MS);
  }

  public cancelPendingRender(): void {
    this.cancelTimer("upgradeTimer");
    this.cancelTimer("hqDeadlineTimer");
    this.clearPendingRender();
  }

  public destroy(): void {
    this.cancelPendingRender();
    this.cancelTimer("adaptiveTransitionTimer");
    // The viewport state outlives this handler (it's a singleton); a stale
    // true here would keep gating arrow keys on the next loaded video.
    this.setFragLoadInFlight(false);
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

  // Manual override: only affects future loads; buffered data unaffected
  public setQualityLevel(level: number): void {
    if (!this.hls || this.hls.loadLevel === level) return;
    this.hls.loadLevel = level;
  }
}
