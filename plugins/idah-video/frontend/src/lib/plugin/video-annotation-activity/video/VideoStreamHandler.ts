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

  constructor(
    videoElement: HTMLVideoElement,
    sourceUrl: string,
    options: VideoStreamHandlerOptions = {}
  ) {
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
      console.log("HLS manifest loaded");
      console.log("Available quality levels:", data.levels.length);
      this.maxQualityLevel = data.levels.length - 1;

      // Start with adaptive quality
      if (this.hls) {
        this.hls.currentLevel = -1; // Auto quality
      }
    });

    // Track level switching
    this.hls.on(Hls.Events.LEVEL_SWITCHING, (event, data) => {
      const newLevel = data.level;
      console.log(`Level switching to: ${newLevel}`);
    });

    // Track fragment loading
    this.hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
      this.fragmentsLoaded++;
      const fragmentLevel = data.frag.level;

      console.log(
        `Fragment ${this.fragmentsLoaded} loaded (segment #${data.frag.sn}, level: ${fragmentLevel})`
      );

      // Stop after initial fragments during initial load
      if (this.isInitialLoad && this.fragmentsLoaded >= this.initialFragmentCount) {
        console.log(
          `Loaded ${this.initialFragmentCount} initial fragments, stopping load until play`
        );
        if (this.hls) {
          this.hls.stopLoad();
        }
        this.isInitialLoad = false;
      }
    });

    // Video play event
    this.videoElement.addEventListener("play", () => {
      console.log("Video play - resuming segment loading");
      this.isPaused = false;
      this.isInitialLoad = false;

      // Hide loader if it's showing
      this.onLoadingChange(false);

      // Resume with adaptive quality
      if (this.hls) {
        this.hls.currentLevel = -1;

        if (this.hls.media && this.hls.media.readyState > 0) {
          this.hls.startLoad();
        }
      }
    });

    // Video pause event
    this.videoElement.addEventListener("pause", () => {
      console.log("Video paused - loading highest quality");
      this.isPaused = true;

      // Switch to highest quality level
      if (this.maxQualityLevel >= 0 && this.hls) {
        const currentLevel = this.hls.currentLevel;

        // Check if we're already at the best quality
        if (currentLevel === this.maxQualityLevel) {
          console.log(`Already at max quality level (${this.maxQualityLevel}), skipping reload`);
          return;
        }

        console.log(`Switching to max quality level: ${this.maxQualityLevel}`);
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

  private hasBufferedCurrentPosition(): boolean {
    // Check if current position has buffered data
    const currentTime = this.videoElement.currentTime;
    const buffered = this.videoElement.buffered;

    for (let i = 0; i < buffered.length; i++) {
      if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
        return true;
      }
    }

    return false;
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

    // Save current time
    const currentTime = this.videoElement.currentTime;
    const currentLevel = this.hls.currentLevel;
    console.log(`Rendering quality frame at time: ${currentTime}s (level: ${level}, current: ${currentLevel})`);

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

    // Listen for fragment loaded events
    const onFragLoaded = (event: string, data: any) => {
      console.log(`Quality level ${level} fragment loaded (count: ${fragmentLoadCount}, level: ${data.frag.level})`);

      // Only count fragments for the target quality level
      if (data.frag.level === level) {
        fragmentLoadCount++;

        // Only process on the second fragment load
        if (fragmentLoadCount === 2) {
          // Remove listener
          if (this.hls) {
            this.hls.off(Hls.Events.FRAG_LOADED, onFragLoaded);
          }

          // Small delay to ensure decoder has processed the data
          setTimeout(() => {
            // Force a tiny seek to refresh the frame
            const oldTime = this.videoElement.currentTime;
            this.videoElement.currentTime = oldTime + 0.001;

            console.log(`Quality level ${level} frame rendered after 2 fragments`);

            // Hide loader only if we showed it
            if (shouldShowLoader) {
              this.onLoadingChange(false);
            }
          }, 50);
        }
      }
    };

    this.hls.on(Hls.Events.FRAG_LOADED, onFragLoaded);
  }

  private renderHighQualityFrame(): void {
    this.renderQualityFrame(this.maxQualityLevel);
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
