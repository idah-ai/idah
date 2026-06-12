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
  // Budget for getting an unbuffered seek painted at HQ (the 3G/4G
  // navigation guard). Used twice: predictively — when one HQ fragment is
  // estimated to take longer than this, the seek paints LQ first without
  // waiting — and reactively, as the deadline after which a direct HQ load
  // that hasn't buffered the target gives up and falls back to LQ.
  slowNetworkThresholdMs?: number;
  onLoadingChange?: (loading: boolean, qualityInfo?: QualityInfo) => void;
}

interface TimeRange {
  start: number;
  end: number;
}

// One in-flight "replace with HQ at time T, then repaint" operation (or the
// LQ-fallback handoff that precedes it on slow networks).
//   fragListener — the FRAG_BUFFERED handler awaiting coverage; unregistered on cancel.
//   settleTimer  — short delay before nudging currentTime once coverage is met.
//   timeoutTimer — safety fallback that tears the render down if the awaited
//                  appends never arrive, so the loader can never hang on.
//   loaderShown  — whether onLoadingChange(true) was emitted for this render
//                  (so cancellation knows whether to emit onLoadingChange(false)).
interface PendingRender {
  fragListener: (event: string, data: any) => void;
  settleTimer: ReturnType<typeof setTimeout> | null;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
  loaderShown: boolean;
}

// Wait this long after buffer coverage is reached before nudging currentTime
// to repaint — lets appends that land in the same tick settle first.
const SETTLE_MS = 50;
// Forward coverage required beyond the target time before a render repaints:
// a seek landing near a fragment boundary needs a little of the next fragment
// to present the frame. Capped at the end of the stream, where there is
// nothing further to wait for.
const RENDER_COVERAGE_S = 0.5;
// Debounce after the last navigation seek before upgrading an LQ frame to HQ.
const UPGRADE_DEBOUNCE_MS = 300;
// Switch to ABR this long after playback starts and stays stable.
const PLAYBACK_ABR_DELAY_MS = 3000;
// renderHQAt inactivity watchdog: abandon a render only after this long with
// no fragment in flight (so the loader can't hang when the awaited append
// never happens). It re-arms while a fragment is downloading, so a slow HQ
// load that takes longer than this is never cut off.
const RENDER_TIMEOUT_MS = 15000;
// Slack when comparing a time against buffered / tracked range boundaries,
// matching the tolerance hls.js itself applies to fragment lookups.
const RANGE_TOLERANCE_S = 0.1;
// Default for options.slowNetworkThresholdMs. One HQ fragment estimated to
// take longer than this marks the connection slow: typical broadband stays
// well under it, while 3G/4G-class bandwidth lands above and gets the
// LQ-first navigation path.
const SLOW_NETWORK_THRESHOLD_MS = 1000;

/**
 * Manages HLS adaptive streaming for a paused-frame annotation workflow.
 *
 * HQ-first design: after a short low-quality burst paints the first frame,
 * the loader is pinned to the highest quality level and every fragment that
 * enters the buffer from then on is HQ. A paused seek into buffered territory
 * therefore needs no quality work at all — the decoder paints HQ straight
 * from the buffer, with no level switch, no flush, and no repaint nudge.
 * This is what eliminates the buffer churn and frame jumping the old
 * LQ-first cycle caused on every navigation.
 *
 * Low quality exists only as a slow-network fallback, applied predict-then-
 * verify: when the measured bandwidth says one HQ fragment would take longer
 * than slowNetworkThresholdMs to download, an unbuffered seek paints LQ first
 * so navigation stays instant (the 3G/4G case); when the prediction says HQ
 * is affordable but the target still isn't buffered after the same budget, a
 * deadline timer falls back to LQ anyway. Either way the frame upgrades once
 * the user settles.
 *
 * The remaining quality work is replacing tracked non-HQ data (the initial
 * burst region, slow-network fallbacks, fragments appended by ABR during
 * playback) when the user settles on a frame inside it. That replacement is
 * targeted: it flushes just the contaminated interval — never the whole
 * buffer — using the same BUFFER_FLUSHING event hls.js fires internally for
 * evictions.
 *
 * Two hls.js API facts this class is built around:
 *   - `hls.currentLevel = N` force-flushes the buffer to switch immediately;
 *     `hls.loadLevel = N` only changes what future loads fetch. We use
 *     loadLevel exclusively so buffered data is never thrown away wholesale.
 *   - While load is started, the stream controller follows media "seeking"
 *     events on its own (aborting stale fragment requests and re-ticking at
 *     the new position), so unbuffered seeks need no manual startLoad call.
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
  // FRAG_LOADED/error). The renderHQAt watchdog uses this to distinguish a
  // genuinely stuck render (nothing downloading) from a slow-but-progressing one.
  private fragLoadInFlight = false;

  private endOfFrameTime: number;
  private initialFragmentCount: number;
  private slowNetworkThresholdMs: number;
  private onLoadingChange: (loading: boolean, qualityInfo?: QualityInfo) => void;

  // ── LQ range bookkeeping ──────────────────────────────────────────
  // One SourceBuffer holds exactly one quality per time range, and MSE does
  // not expose which level the bytes came from — so the handler keeps its own
  // map. Every appended non-HQ fragment adds its window here; every appended
  // HQ fragment subtracts it. FRAG_BUFFERED reports what actually landed in
  // the buffer (not what was requested), so this map is ground truth even
  // when loads race or get aborted. A buffered seek consults it to decide
  // between "free — decoder paints HQ from buffer" and "schedule an upgrade".
  private lqRanges: TimeRange[] = [];

  // The single in-flight render. Only one exists at a time; starting a new one
  // (or cancelling) clears the previous.
  private pendingRender: PendingRender | null = null;

  // Debounce timer that fires upgradeToHQ() after navigation stops.
  private upgradeTimer: ReturnType<typeof setTimeout> | null = null;

  // Reactive fallback for direct-HQ seeks: armed when an unbuffered seek is
  // predicted fast enough to wait for HQ. If the target still isn't buffered
  // when it fires, the prediction was wrong — paint LQ instead.
  private hqDeadlineTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.slowNetworkThresholdMs = options.slowNetworkThresholdMs ?? SLOW_NETWORK_THRESHOLD_MS;
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

    // Record quality levels; run the initial burst at LQ so the first frame
    // appears fast. loadLevel (not currentLevel) — nothing to flush yet, but
    // the invariant is that this class never uses the flushing setter.
    this.hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      this.maxQualityLevel = data.levels.length - 1;
      if (this.hls) this.hls.loadLevel = 0;
    });

    // Track in-flight fragment requests so the render watchdog can tell a slow
    // download apart from a truly stalled one.
    this.hls.on(Hls.Events.FRAG_LOADING, () => {
      this.fragLoadInFlight = true;
    });

    // Maintain the LQ range map from what actually lands in the SourceBuffer.
    this.hls.on(Hls.Events.FRAG_BUFFERED, (_event, data) => {
      const frag = data.frag;
      if (frag.type !== "main") return;
      const start = frag.start;
      const end = frag.start + frag.duration;
      if (frag.level === this.maxQualityLevel) this.subtractLQRange(start, end);
      else this.addLQRange(start, end);
    });

    // After the initial LQ burst: pin the loader to HQ for good, and replace
    // the burst region under the current frame so the annotator sees full
    // quality from the start. renderHQAt is called unconditionally (not via
    // upgradeToHQ) because FRAG_BUFFERED for the newest burst fragment may
    // not have fired yet — the burst region is LQ by construction.
    this.hls.on(Hls.Events.FRAG_LOADED, () => {
      this.fragLoadInFlight = false;
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
      // Hand quality selection to ABR after a few seconds of stable playback.
      // loadLevel = -1 switches future loads only — no flush, no stutter.
      // Whatever levels ABR appends are recorded by the FRAG_BUFFERED map,
      // so any non-HQ playback data is upgraded on the next paused visit.
      this.adaptiveTransitionTimer = setTimeout(() => {
        this.adaptiveTransitionTimer = null;
        if (this.hls && !this.videoElement.paused) {
          this.hls.loadLevel = -1;
        }
      }, PLAYBACK_ABR_DELAY_MS);
    };
    this.videoElement.addEventListener("play", this.boundPlayHandler);

    // On pause (from play or natural end): re-pin the loader to HQ (playback
    // may have handed it to ABR) and upgrade the settled frame if it landed
    // on non-HQ data. No debounce — when the annotator stops, they want
    // detail now.
    this.boundPauseHandler = () => {
      this.cancelTimer("adaptiveTransitionTimer");
      this.isPaused = true;
      if (this.maxQualityLevel < 0 || !this.hls) return;
      this.hls.loadLevel = this.maxQualityLevel;
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

  // Drop tracked ranges whose data has been evicted from the SourceBuffer
  // (browser quota eviction, flushes we didn't initiate). Called lazily
  // before any lookup so the map never claims LQ where nothing is buffered.
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

  // Estimated seconds to download one max-quality fragment at the measured
  // bandwidth. Null when the manifest doesn't provide enough to estimate (no
  // level details loaded yet, no BANDWIDTH attribute) — callers treat that as
  // "not slow" and let the direct HQ path run.
  private estimateHQFragmentSeconds(): number | null {
    if (!this.hls || this.maxQualityLevel <= 0) return null;
    const level = this.hls.levels[this.maxQualityLevel];
    if (!level || !level.bitrate) return null;
    // HQ level details may not be loaded before the first HQ fetch; all
    // levels share segmentation, so any loaded level's duration works.
    const details = level.details ?? this.hls.levels.find((l) => l.details)?.details;
    const fragDuration = details?.averagetargetduration ?? details?.targetduration;
    const bandwidth = this.hls.bandwidthEstimate;
    if (!fragDuration || !bandwidth || !Number.isFinite(bandwidth)) return null;
    return (level.bitrate * fragDuration) / bandwidth;
  }

  // ── Core primitive ────────────────────────────────────────────────

  // Replace the non-HQ data covering `time` with max-quality fragments, then
  // flush the decoder with a same-value seek so the new quality paints.
  //
  // The flush is targeted: only the tracked LQ intervals inside the buffered
  // range containing `time` are dropped, via the same BUFFER_FLUSHING event
  // hls.js triggers internally for evictions (the buffer controller performs
  // the remove, the fragment tracker forgets the fragments, and the stream
  // controller re-ticks after BUFFER_FLUSHED to refill the gap at loadLevel).
  // HQ data elsewhere in the buffer — including elsewhere in the same range —
  // survives untouched.
  private renderHQAt(time: number): void {
    if (!this.hls) return;
    this.clearPendingRender();

    const level = this.maxQualityLevel;
    // This is only called when a frame is already painting at `time` (the
    // buffered LQ frame), so framePending stays false — surface the upgrade
    // through the HQ badge instead.
    this.onLoadingChange(true, this.getQualityInfo(level));

    // Stop the loader before flushing so it can't append mid-flush. An
    // aborted in-flight fragment never fires FRAG_LOADED, so reset the
    // in-flight marker by hand or the watchdog would re-arm forever.
    this.hls.stopLoad();
    this.fragLoadInFlight = false;

    const range = this.bufferedRangeContaining(time);
    let toFlush = range ? this.lqRanges.filter((r) => r.start < range.end && range.start < r.end) : [];
    // The map can trail reality: FRAG_BUFFERED for the newest fragment may
    // not have fired yet (this is the normal state right after the initial
    // burst). If data is buffered at `time` but nothing is tracked there,
    // flush the whole containing range — re-downloading it at HQ is exactly
    // the recovery we want, and it can only happen for freshly-appended LQ.
    if (range && !toFlush.some((r) => time >= r.start - RANGE_TOLERANCE_S && time <= r.end + RANGE_TOLERANCE_S)) {
      toFlush = [range];
    }
    for (const r of toFlush) {
      this.hls.trigger(Hls.Events.BUFFER_FLUSHING, { startOffset: r.start, endOffset: r.end, type: null });
      this.subtractLQRange(r.start, r.end);
    }

    // Re-assert the pin: a slow-network fallback may have left the loader on
    // level 0, and the fragListener below only counts fragments at `level`.
    this.hls.loadLevel = level;
    this.hls.startLoad(time);

    // Completion is *coverage*-based on FRAG_BUFFERED (the append actually
    // landed), not a count of FRAG_LOADED events (only downloaded — the
    // append may still be transmuxing, and a buffered-check 50 ms later can
    // race it). The render is done when the buffer holds data at `time` and
    // slightly beyond — already-buffered HQ forward of the flushed gap
    // counts. Counting fragment loads here would hang when the gap is a
    // single fragment surrounded by HQ: hls.js reloads that one fragment,
    // goes idle, and a second load never comes — the watchdog would then
    // tear the render down without ever repainting, leaving an LQ frame on
    // screen with HQ data sitting in the buffer.
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

    // Inactivity watchdog, not an absolute deadline: as long as a fragment is
    // actually downloading (fragLoadInFlight) it re-arms, so a legitimately
    // slow HQ load — which can exceed RENDER_TIMEOUT_MS on poor connections —
    // is never cut off. It only tears the render down when nothing is in
    // flight and the required fragments still haven't landed.
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

  // Paint the unbuffered target at LQ first so navigation stays instant on a
  // slow connection, then hand off to the standard debounced HQ upgrade once
  // the LQ data has actually landed. The debounce must not start any earlier:
  // on a slow network the LQ fragment itself can take longer than the
  // debounce, and upgradeToHQ would find nothing tracked at `time` and skip.
  // The appended level-0 data is recorded by the FRAG_BUFFERED map, so even a
  // render cancelled mid-flight leaves the region tracked for a later visit.
  private renderLQFallbackAt(time: number): void {
    if (!this.hls) return;
    this.clearPendingRender();

    // Redirect the loader to LQ deterministically. The aborted in-flight
    // fragment never fires FRAG_LOADED, so reset the in-flight marker.
    this.hls.stopLoad();
    this.fragLoadInFlight = false;
    this.hls.loadLevel = 0;
    this.hls.startLoad(time);

    // No loader badge: the pending element seek keeps framePending true, so
    // the "Loading Frame" pill already covers this phase. The handoff waits
    // on FRAG_BUFFERED (append landed) rather than FRAG_LOADED (only
    // downloaded): with FRAG_LOADED, a buffered-check could race the append
    // and — when `time` sits in the last LQ fragment this load will produce —
    // wait forever for another fragment that never comes.
    const fragListener = (_event: string, data: any) => {
      if (data.frag.level !== 0 || data.frag.type !== "main") return;
      if (!this.isBufferedAt(time)) return; // a different fragment — keep listening
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

  // Upgrade the frame at `time` to max quality if — and only if — it sits on
  // tracked non-HQ data. With the loader pinned to HQ, every other case needs
  // nothing: buffered-clean positions are already HQ, and unbuffered positions
  // are being filled at HQ by the seek-follow load (the pending element seek
  // paints when the data arrives).
  private upgradeToHQ(time: number): void {
    this.cancelTimer("upgradeTimer");
    if (!this.hls || !this.isPaused || this.maxQualityLevel <= 0) return;
    if (!this.lqRangeAt(time)) return;
    this.renderHQAt(time);
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Single entry point for all paused seeks.
   *
   * The dominant case — the target is buffered and clean — costs nothing:
   * the seek already performed in Video.svelte paints HQ straight from the
   * buffer. Only seeks landing on tracked LQ data schedule work, and only
   * after navigation rests (so arrow-key holds stream buffered frames at
   * full responsiveness, exactly as before).
   */
  public loadQuality(time: number): void {
    if (!this.hls || this.maxQualityLevel < 0) return;

    this.cancelPendingRender();

    // Unbuffered target: decide by measured bandwidth whether HQ is
    // affordable. On a fast network the HQ-pinned loader follows the element
    // seek on its own and the frame paints directly at full quality, with
    // framePending driving the "Loading Frame" pill meanwhile. On a slow
    // network (the 3G/4G case) waiting for HQ would stall navigation, so an
    // LQ frame is painted first and upgraded once the user settles.
    if (!this.isBufferedAt(time)) {
      const estimate = this.estimateHQFragmentSeconds();
      if (estimate !== null && estimate * 1000 > this.slowNetworkThresholdMs) {
        // Confidently slow: don't wait, paint LQ now.
        this.renderLQFallbackAt(time);
        return;
      }
      if (this.hls.loadLevel !== this.maxQualityLevel) {
        // A previous slow seek may have left the loader on LQ — restore the
        // HQ pin; the seek-follow load picks it up for the next fragment.
        this.hls.loadLevel = this.maxQualityLevel;
      }
      // Predicted fast (or unknown) — but verify. The estimate only counts
      // one fragment's bytes; the real time-to-paint also includes playlist
      // and init-segment requests plus RTTs, so a "fast" prediction can
      // still stall on a slow connection. If the target isn't buffered when
      // the deadline fires, stop waiting for HQ and paint LQ instead. The
      // deadline is cancelled by any newer navigation or play (both funnel
      // through cancelPendingRender).
      this.hqDeadlineTimer = setTimeout(() => {
        this.hqDeadlineTimer = null;
        if (!this.isPaused || !this.hls) return;
        if (this.isBufferedAt(time)) return; // HQ made it in time
        this.renderLQFallbackAt(time);
      }, this.slowNetworkThresholdMs);
      return;
    }

    // Buffered and clean: already HQ, the decoder paints it — free.
    if (!this.lqRangeAt(time)) return;

    // Buffered but LQ: the LQ frame paints instantly; upgrade after
    // navigation rests. Every new call resets the timer, so rapid
    // navigation never upgrades mid-flight.
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

  // Manual quality override. Only affects what future loads fetch (-1 = ABR);
  // already-buffered data is left in place and tracked by the FRAG_BUFFERED
  // map, so a non-HQ override is upgraded again the next time the user
  // settles on a frame inside it while paused.
  public setQualityLevel(level: number): void {
    if (!this.hls || this.hls.loadLevel === level) return;
    this.hls.loadLevel = level;
  }
}
