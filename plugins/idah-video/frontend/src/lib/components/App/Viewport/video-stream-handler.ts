import Hls from "hls.js";

interface QualityInfo {
  height: number;
  width: number;
  label: string;
}

interface VideoStreamHandlerOptions {
  initialFragmentCount?: number;
  onLoadingChange?: (loading: boolean, qualityInfo?: QualityInfo) => void;
}

export class VideoStreamHandler {
  private videoElement: HTMLVideoElement;
  private sourceUrl: string;
  private hls: Hls | null;
  private fragmentsLoaded: number;
  private isInitialLoad: boolean;
  private isPaused: boolean;
  private initialFragmentCount: number;
  private maxQualityLevel: number;
  private onLoadingChange: (loading: boolean, qualityInfo?: QualityInfo) => void;
  // Track the in-flight render so a new call can cancel the previous one
  // before it fires its micro-seek, preventing stale FRAG_LOADED listeners
  // from accumulating during rapid frame navigation (key-hold).
  private pendingFragListener: ((event: string, data: any) => void) | null;
  private pendingRenderTimer: ReturnType<typeof setTimeout> | null;

  constructor(videoElement: HTMLVideoElement, sourceUrl: string, options: VideoStreamHandlerOptions = {}) {
    this.videoElement = videoElement;
    this.sourceUrl = sourceUrl;
    this.hls = null;
    this.fragmentsLoaded = 0;
    this.isInitialLoad = true;
    this.isPaused = true;

    // Configuration
    this.initialFragmentCount = options.initialFragmentCount || 1;
    this.maxQualityLevel = -1; // Will be set after manifest is parsed
    this.onLoadingChange = options.onLoadingChange || (() => {}); // Callback for loading state
    this.pendingFragListener = null;
    this.pendingRenderTimer = null;

    this.init();
  }

  private init(): void {
    if (!Hls.isSupported()) {
      // For Safari with native HLS support
      if (this.videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        this.videoElement.src = this.sourceUrl;
      }
      return;
    }

    this.hls = new Hls({
      maxBufferLength: 10,
      maxMaxBufferLength: 10,
      autoStartLoad: false, // Manual control
      debug: false,
    });

    this.hls.loadSource(this.sourceUrl);
    this.hls.attachMedia(this.videoElement);

    this.setupEventListeners();

    // Manually start load for controlled initial loading
    this.hls.startLoad(0);
  }

  private setupEventListeners(): void {
    if (!this.hls) return;

    // Manifest parsed - get available quality levels
    this.hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      this.maxQualityLevel = data.levels.length - 1;

      // Start with highest quality
      if (this.hls) {
        this.hls.currentLevel = this.maxQualityLevel; // Highest quality
      }
    });

    // Track fragment loading
    this.hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
      this.fragmentsLoaded++;

      // Stop after initial fragments during initial load
      if (this.isInitialLoad && this.fragmentsLoaded >= this.initialFragmentCount) {
        if (this.hls) {
          this.hls.stopLoad();
        }
        this.isInitialLoad = false;
      }
    });

    // Video play event
    this.videoElement.addEventListener("play", () => {
      this.isPaused = false;
      this.isInitialLoad = false;

      // Cancel any in-flight HQ render — the micro-seek timer must not fire
      // during playback, and we want HLS to start loading from the current
      // seek position (not from wherever it last buffered).
      this.cancelPendingRender();

      // Switch to adaptive quality for smooth playback based on connection.
      // Pass currentTime so HLS loads from where the user actually seeked to,
      // not from the previous buffer position (which may be far ahead).
      if (this.hls) {
        this.hls.currentLevel = -1;

        if (this.hls.media && this.hls.media.readyState > 0) {
          this.hls.startLoad(this.videoElement.currentTime);
        }
      }
    });

    // Video pause event
    this.videoElement.addEventListener("pause", () => {
      this.isPaused = true;

      // Switch to highest quality level
      if (this.maxQualityLevel >= 0 && this.hls) {
        const currentLevel = this.hls.currentLevel;

        // Check if we're already at the best quality
        if (currentLevel === this.maxQualityLevel) {
          return;
        }

        this.hls.currentLevel = this.maxQualityLevel;

        // Load and render high quality frame immediately
        this.renderHighQualityFrame();
      }
    });

    // Error handling
    this.hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        console.error("Fatal HLS error:", data);

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log("Network error, attempting to recover...");
            if (this.hls) {
              this.hls.startLoad();
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log("Media error, attempting to recover...");
            if (this.hls) {
              this.hls.recoverMediaError();
            }
            break;
          default:
            console.error("Unrecoverable error");
            this.destroy();
            break;
        }
      }
    });
  }

  private getQualityInfo(levelIndex?: number): QualityInfo | undefined {
    if (!this.hls || this.maxQualityLevel < 0) {
      return undefined;
    }

    // Use provided level index or default to max quality
    const targetLevel = levelIndex !== undefined ? levelIndex : this.maxQualityLevel;

    // Handle adaptive quality (-1)
    if (targetLevel === -1) {
      return {
        height: 0,
        width: 0,
        label: "Auto",
      };
    }

    if (targetLevel < 0 || targetLevel >= this.hls.levels.length) {
      return undefined;
    }

    const level = this.hls.levels[targetLevel];
    return {
      height: level.height,
      width: level.width,
      label: `${level.height}p`,
    };
  }

  private renderQualityFrame(level: number): void {
    if (!this.hls) return;

    // Cancel any in-flight render from a previous call so stale FRAG_LOADED
    // listeners don't pile up and fire spurious micro-seeks later.
    if (this.pendingFragListener) {
      this.hls.off(Hls.Events.FRAG_LOADED, this.pendingFragListener);
      this.pendingFragListener = null;
    }
    if (this.pendingRenderTimer) {
      clearTimeout(this.pendingRenderTimer);
      this.pendingRenderTimer = null;
    }

    // Save current time
    const currentTime = this.videoElement.currentTime;
    const currentLevel = this.hls.currentLevel;

    // Get the quality level info
    const qualityInfo = this.getQualityInfo(level);

    // Check if we're already at the target quality level
    const shouldShowLoader = currentLevel !== level;

    // Only notify loading if quality is actually changing
    if (shouldShowLoader) {
      this.onLoadingChange(true, qualityInfo);
    }

    // Force HLS to reload from current position with specified quality
    this.hls.startLoad(currentTime);

    // Track fragment loads
    let fragmentLoadCount = 0;

    // Determine how many fragments will be loaded at this position.
    // At the last fragment there is nothing "next" to load, so count=1 is enough.
    const levelDetails = this.hls.levels[level]?.details;
    let requiredCount = 2; // default: fragment covering currentTime + next
    if (levelDetails) {
      const frags = levelDetails.fragments;
      const lastFrag = frags[frags.length - 1];
      if (lastFrag && currentTime >= lastFrag.start) {
        requiredCount = 1;
      }
    }

    // Listen for fragment loaded events
    const onFragLoaded = (event: string, data: any) => {
      // Only count fragments for the target quality level
      if (data.frag.level === level) {
        fragmentLoadCount++;

        // Only process on the second fragment load
        if (fragmentLoadCount >= requiredCount) {
          // Remove listener and clear the tracked reference
          if (this.hls) {
            this.hls.off(Hls.Events.FRAG_LOADED, onFragLoaded);
          }
          this.pendingFragListener = null;

          // Small delay to ensure decoder has processed the data
          this.pendingRenderTimer = setTimeout(() => {
            this.pendingRenderTimer = null;
            // Re-seek to the exact position captured when this render was initiated.
            // The HTML5 spec guarantees 'seeked' fires even for a same-value seek,
            // which flushes the decoder pipeline and forces it to render the fresh
            // HQ data from the SourceBuffer. Unlike ±delta approaches, this can
            // never overshoot a frame boundary or go past the video end.
            this.videoElement.currentTime = currentTime;

            // Hide loader only if we showed it
            if (shouldShowLoader) {
              this.onLoadingChange(false);
            }
          }, 50);
        }
      }
    };

    this.pendingFragListener = onFragLoaded;
    this.hls.on(Hls.Events.FRAG_LOADED, onFragLoaded);
  }

  private renderHighQualityFrame(): void {
    this.renderQualityFrame(this.maxQualityLevel);
  }

  /**
   * Cancel any in-flight HQ render (fragment listener + micro-seek timer).
   * Call this whenever the user navigates to a new position or starts playback
   * so stale timers cannot seek the video element to old positions.
   */
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
    if (wasLoading) {
      this.onLoadingChange(false);
    }
  }

  public destroy(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
  }

  // Public methods to control loading behavior
  public setInitialFragmentCount(count: number): void {
    this.initialFragmentCount = count;
  }

  public getCurrentQualityLevel(): number {
    return this.hls ? this.hls.currentLevel : -1;
  }

  public setQualityLevel(level: number): void {
    if (!this.hls) return;

    const currentLevel = this.hls.currentLevel;

    // Check if we're actually changing quality
    if (currentLevel === level) {
      console.log(`Already at quality level ${level}, no change needed`);
      return;
    }

    console.log(`Changing quality level from ${currentLevel} to ${level}`);

    // Set the new quality level - LEVEL_SWITCHING event will handle loading state
    this.hls.currentLevel = level;

    // If video is paused and switching to a specific quality (not auto), render the frame
    if (this.isPaused && level !== -1) {
      this.renderQualityFrame(level);
    }
  }

  public reloadCurrentQuality(): void {
    if (!this.hls || !this.isPaused || this.maxQualityLevel < 0) return;

    const currentLevel = this.hls.currentLevel;

    // If on auto quality (-1), switch to max quality
    if (currentLevel === -1) {
      console.log(`Currently on auto quality, switching to max quality: ${this.maxQualityLevel}`);
      this.hls.currentLevel = this.maxQualityLevel;
      this.renderQualityFrame(this.maxQualityLevel);
    } else {
      // Reload the current specific quality level
      this.renderQualityFrame(currentLevel);
    }
  }
}
