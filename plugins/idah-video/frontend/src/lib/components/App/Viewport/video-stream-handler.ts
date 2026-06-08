import Hls from "hls.js";

interface QualityInfo {
  height: number;
  width: number;
  label: string;
}

interface VideoStreamHandlerOptions {
  // Exact timestamp (seconds) of the last frame, computed from database metadata
  // via frameToTime(totalFrames - 1). Passed by Video.svelte so renderQualityFrame
  // uses the authoritative frame time instead of videoElement.duration, which can
  // differ from the database frame count due to HLS segmentation rounding.
  endOfFrameTime?: number;
  initialFragmentCount?: number;
  onLoadingChange?: (loading: boolean, qualityInfo?: QualityInfo) => void;
}

/**
 * Manages HLS adaptive streaming for a video element.
 *
 * Quality strategy:
 *  - Initial load  → max quality, stops after `initialFragmentCount` fragments
 *                    so only the first frames are buffered upfront.
 *  - Playback      → adaptive (ABR), HLS runs continuously forward.
 *  - Pause / seek  → max quality re-rendered on demand via renderQualityFrame().
 *
 * The two key async flows are:
 *  play  → isPaused=false, cancelPendingRender(), switch to adaptive, restart load.
 *  pause → isPaused=true,  renderHighQualityFrame() to upgrade the current frame.
 */
export class VideoStreamHandler {
  private videoElement: HTMLVideoElement;
  private sourceUrl: string;
  private hls: Hls | null = null;
  private fragmentsLoaded = 0;
  private isInitialLoad = true;
  private isPaused = true;
  // Timestamp of the last frame derived from database metadata (frameToTime(totalFrames-1)).
  // Used instead of videoElement.duration when ended — the browser-reported duration can
  // differ from the database frame count, causing HLS to miss the correct last fragment.
  private endOfFrameTime: number;
  private initialFragmentCount: number;
  // Index of the highest quality level reported by the HLS manifest (-1 until ready).
  private maxQualityLevel = -1;
  private onLoadingChange: (loading: boolean, qualityInfo?: QualityInfo) => void;
  // In-flight HQ render state.
  // pendingFragListener: FRAG_LOADED handler waiting for enough fragments.
  // pendingRenderTimer:  50 ms commit timer that re-seeks after fragments arrive.
  // Both are cancelled together on any new seek or play to prevent stale seeks.
  private pendingFragListener: ((event: string, data: any) => void) | null = null;
  private pendingRenderTimer: ReturnType<typeof setTimeout> | null = null;
  // True while hls.startLoad() is active.
  // Prevents a redundant startLoad() in the play listener: if renderQualityFrame
  // already started HLS for an HQ frame, calling startLoad() again during the
  // adaptive quality switch flushes the SourceBuffer and snaps currentTime to the
  // buffer end instead of the seeked position.
  private hlsRunning = false;

  constructor(videoElement: HTMLVideoElement, sourceUrl: string, options: VideoStreamHandlerOptions = {}) {
    this.videoElement = videoElement;
    this.sourceUrl = sourceUrl;
    this.endOfFrameTime = options.endOfFrameTime ?? 0.1;
    this.initialFragmentCount = options.initialFragmentCount ?? 1;
    this.onLoadingChange = options.onLoadingChange ?? (() => {});
    this.init();
  }

  // ── Initialisation ────────────────────────────────────────────────
  // Creates the Hls instance with a small buffer cap (10 s) so we don't
  // pre-buffer the whole video. autoStartLoad=false lets us control exactly
  // when and from where loading begins.
  private init(): void {
    if (!Hls.isSupported()) {
      // Safari has native HLS support; assign the URL directly.
      if (this.videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        this.videoElement.src = this.sourceUrl;
      }
      return;
    }

    this.hls = new Hls({ maxBufferLength: 10, maxMaxBufferLength: 10, autoStartLoad: false, debug: false });
    this.hls.loadSource(this.sourceUrl);
    this.hls.attachMedia(this.videoElement);
    this.setupEventListeners();
    // Kick off loading from the beginning so the first frame is ready immediately.
    this.hls.startLoad(0);
    this.hlsRunning = true;
  }

  // ── Event listeners ───────────────────────────────────────────────
  private setupEventListeners(): void {
    if (!this.hls) return;

    // Once the manifest arrives we know how many quality levels exist.
    // Start at max so the initial frames load in the best resolution.
    this.hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      this.maxQualityLevel = data.levels.length - 1;
      if (this.hls) this.hls.currentLevel = this.maxQualityLevel;
    });

    // Initial burst limiter: stop HLS after the configured number of fragments
    // so we don't buffer the entire video on load. After this point, loading
    // is restarted on demand — either by the play listener or renderQualityFrame.
    this.hls.on(Hls.Events.FRAG_LOADED, () => {
      this.fragmentsLoaded++;
      if (this.isInitialLoad && this.fragmentsLoaded >= this.initialFragmentCount) {
        this.hls?.stopLoad();
        this.isInitialLoad = false;
        this.hlsRunning = false;
      }
    });

    // Play flow:
    //   1. Mark not-paused and cancel any pending HQ render (stale after play).
    //   2. Switch HLS to adaptive (ABR) so it selects quality based on bandwidth.
    //   3. If HLS was stopped (post-initial-burst or post-pause), restart it from
    //      the current position so it buffers forward from where playback begins.
    //   4. Skip startLoad() if hlsRunning=true: renderQualityFrame already started
    //      HLS; a second call would flush the SourceBuffer on the level change.
    this.videoElement.addEventListener("play", () => {
      this.isPaused = false;
      this.isInitialLoad = false;
      this.cancelPendingRender();

      if (!this.hls) return;
      this.hls.currentLevel = -1; // adaptive for playback

      if (this.hls.media && this.hls.media.readyState > 0 && !this.hlsRunning) {
        this.hls.startLoad(this.videoElement.currentTime);
        this.hlsRunning = true;
      }
    });

    // Pause flow (fires for manual pause, end-of-video, and programmatic pause):
    //   1. Mark paused.
    //   2. If we are not already at max quality, reload the current frame at HQ.
    //      renderQualityFrame handles the ended case internally by substituting
    //      endOfFrameTime for videoElement.currentTime (see renderQualityFrame).
    //      Do NOT pre-set currentLevel here — renderQualityFrame reads it first to
    //      decide whether to show the loading indicator; setting it beforehand would
    //      always produce shouldShowLoader=false and hide the UI.
    this.videoElement.addEventListener("pause", () => {
      this.isPaused = true;
      if (this.maxQualityLevel < 0 || !this.hls) return;
      if (this.hls.currentLevel === this.maxQualityLevel) return;
      this.renderHighQualityFrame();
    });

    // Fatal HLS errors: attempt recovery before giving up entirely.
    this.hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) this.hls?.startLoad();
      else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) this.hls?.recoverMediaError();
      else this.destroy();
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────
  private getQualityInfo(level: number): QualityInfo | undefined {
    if (level === -1) return { height: 0, width: 0, label: "Auto" };
    if (!this.hls || level < 0 || level >= this.hls.levels.length) return undefined;
    const { height, width } = this.hls.levels[level];
    return { height, width, label: `${height}p` };
  }

  // ── Core HQ render ────────────────────────────────────────────────
  // Loads enough fragments at `level` quality to cover the current position,
  // then performs a same-value seek to flush the decoder and repaint the frame.
  //
  // Render flow:
  //   1. Cancel any prior in-flight render (new seek supersedes old one).
  //   2. Switch HLS to the target quality level.
  //   3. Start loading from currentTime so HLS fetches the right segments.
  //   4. Wait for the required number of FRAG_LOADED events (1 at end-of-file,
  //      2 otherwise — current fragment + next for decoder look-ahead).
  //   5. After a 50 ms settle window, verify the position is buffered, then
  //      write the same currentTime back to flush the decoder pipeline so the
  //      fresh HQ data is rendered on screen.
  private renderQualityFrame(level: number): void {
    if (!this.hls) return;

    // Cancel prior render; show a new loader immediately below if needed.
    if (this.pendingFragListener) {
      this.hls.off(Hls.Events.FRAG_LOADED, this.pendingFragListener);
      this.pendingFragListener = null;
    }
    if (this.pendingRenderTimer) {
      clearTimeout(this.pendingRenderTimer);
      this.pendingRenderTimer = null;
    }

    // When ended, videoElement.currentTime === videoElement.duration which can be
    // slightly past the last HLS fragment boundary — hls.startLoad(duration) would
    // find nothing to load and FRAG_LOADED would never fire. Use the database-derived
    // endOfFrameTime instead; it always lands inside the last fragment.
    const currentTime = this.videoElement.ended ? this.endOfFrameTime : this.videoElement.currentTime;

    // Check loader visibility BEFORE switching level: after the switch
    // currentLevel === level, so the check would always return false.
    const shouldShowLoader = this.hls.currentLevel !== level;
    this.hls.currentLevel = level;
    if (shouldShowLoader) this.onLoadingChange(true, this.getQualityInfo(level));

    this.hls.startLoad(currentTime);
    this.hlsRunning = true;

    // At the last fragment we only need 1 loaded segment; elsewhere we need 2
    // (current + next) to satisfy the decoder's look-ahead requirement.
    const frags = this.hls.levels[level]?.details?.fragments ?? [];
    const lastFrag = frags[frags.length - 1];
    const requiredCount = lastFrag && currentTime >= lastFrag.start ? 1 : 2;
    let fragmentLoadCount = 0;

    const onFragLoaded = (_event: string, data: any) => {
      if (data.frag.level !== level) return;
      if (++fragmentLoadCount < requiredCount) return;

      this.hls?.off(Hls.Events.FRAG_LOADED, onFragLoaded);
      this.pendingFragListener = null;

      // 50 ms settle: give the SourceBuffer time to append the new segment before
      // we re-seek. Also acts as a last-moment guard against a play() call that
      // could race with the decoder pipeline.
      this.pendingRenderTimer = setTimeout(() => {
        this.pendingRenderTimer = null;

        // Skip if play() was called during the 50 ms window.
        if (!this.videoElement.paused) {
          if (shouldShowLoader) this.onLoadingChange(false);
          return;
        }

        // Guard: a quality-change SourceBuffer flush can leave the buffer empty
        // at currentTime. Seeking into an empty buffer resets currentTime to 0
        // and displays the wrong frame. Skip the re-seek if not buffered.
        const b = this.videoElement.buffered;
        let isBuffered = false;
        for (let i = 0; i < b.length; i++) {
          if (b.start(i) <= currentTime + 0.1 && currentTime <= b.end(i) + 0.1) {
            isBuffered = true;
            break;
          }
        }
        if (!isBuffered) {
          if (shouldShowLoader) this.onLoadingChange(false);
          return;
        }

        // Same-value seek flushes the decoder so it composites the new HQ data.
        this.videoElement.currentTime = currentTime;
        if (shouldShowLoader) this.onLoadingChange(false);
      }, 50);
    };

    this.pendingFragListener = onFragLoaded;
    this.hls.on(Hls.Events.FRAG_LOADED, onFragLoaded);
  }

  // Shorthand: render the current frame at the highest available quality level.
  private renderHighQualityFrame(): void {
    this.renderQualityFrame(this.maxQualityLevel);
  }

  // ── Public API ────────────────────────────────────────────────────

  // Cancel any in-flight HQ render and hide the loading indicator.
  // Called by Video.svelte before play() and on every new seek to prevent a
  // stale timer from seeking to an outdated position.
  public cancelPendingRender(): void {
    const wasLoading = this.pendingFragListener !== null || this.pendingRenderTimer !== null;
    if (this.pendingFragListener && this.hls) {
      this.hls.off(Hls.Events.FRAG_LOADED, this.pendingFragListener);
      this.pendingFragListener = null;
    }
    if (this.pendingRenderTimer) {
      clearTimeout(this.pendingRenderTimer);
      this.pendingRenderTimer = null;
    }
    if (wasLoading) this.onLoadingChange(false);
  }

  // Tear down HLS and release all resources.
  public destroy(): void {
    this.hls?.destroy();
    this.hls = null;
  }

  public setInitialFragmentCount(count: number): void {
    this.initialFragmentCount = count;
  }

  public getCurrentQualityLevel(): number {
    return this.hls?.currentLevel ?? -1;
  }

  // Explicitly switch to a quality level.
  // While paused, uses renderQualityFrame so the frame is reloaded at the new
  // quality and the loading indicator appears correctly.
  // During playback, just sets currentLevel and lets ABR handle the transition.
  public setQualityLevel(level: number): void {
    if (!this.hls || this.hls.currentLevel === level) return;
    if (this.isPaused && level !== -1) {
      this.renderQualityFrame(level);
    } else {
      this.hls.currentLevel = level;
    }
  }

  // Re-render the current frame at the best available quality.
  // Called by Video.svelte after the 300 ms seek debounce to upgrade the frame
  // once the user stops navigating. Resolves adaptive (-1) to maxQualityLevel
  // without pre-setting currentLevel so renderQualityFrame can compute the
  // correct shouldShowLoader value.
  public reloadCurrentQuality(): void {
    if (!this.hls || !this.isPaused || this.maxQualityLevel < 0) return;
    const level = this.hls.currentLevel === -1 ? this.maxQualityLevel : this.hls.currentLevel;
    this.renderQualityFrame(level);
  }
}
