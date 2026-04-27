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

    // Track fragment loading
    this.hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
      this.fragmentsLoaded++;
      console.log(
        `Fragment ${this.fragmentsLoaded} loaded (segment #${data.frag.sn}, level: ${data.frag.level})`
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

  private getQualityInfo(): QualityInfo | undefined {
    if (!this.hls || this.maxQualityLevel < 0) {
      return undefined;
    }

    const level = this.hls.levels[this.maxQualityLevel];
    return {
      height: level.height,
      width: level.width,
      label: `${level.height}p`,
    };
  }

  private renderHighQualityFrame(): void {
    if (!this.hls) return;

    // Save current time
    const currentTime = this.videoElement.currentTime;
    console.log(`Rendering high quality frame at time: ${currentTime}s`);

    // Get the quality level info
    const qualityInfo = this.getQualityInfo();

    // Notify that loading has started
    this.onLoadingChange(true, qualityInfo);

    // Force HLS to reload from current position with highest quality
    this.hls.startLoad(currentTime);

    // Listen for buffer append completion which means data is ready
    const onBufferAppended = () => {
      console.log("High quality buffer appended");

      // Remove listener
      if (this.hls) {
        this.hls.off(Hls.Events.BUFFER_APPENDED, onBufferAppended);
      }

      // Small delay to ensure decoder has processed the data
      setTimeout(() => {
        // Force a tiny seek to refresh the frame
        const oldTime = this.videoElement.currentTime;
        this.videoElement.currentTime = oldTime + 0.001;

        console.log("High quality frame rendered");

        // Hide loader immediately
        this.onLoadingChange(false);
      }, 50);
    };

    this.hls.on(Hls.Events.BUFFER_APPENDED, onBufferAppended);
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
    if (this.hls) {
      this.hls.currentLevel = level;
    }
  }
}
