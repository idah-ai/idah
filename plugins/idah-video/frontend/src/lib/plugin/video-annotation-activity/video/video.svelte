<script lang="ts">
  import { onMount } from "svelte";
  import { VideoStreamHandler } from "./VideoStreamHandler.ts";

  let {
    src = undefined,
    fps,
    initialFragments = 3,
    bind: videoRef = undefined,
    element = $bindable(),
    onFrameUpdate = (currentFrame: number) => {},
    onTogglePlay = (playing: boolean) => {},
    onResize = () => {},
  } = $props();

  let videoElement: HTMLVideoElement;
  let streamHandler: VideoStreamHandler | undefined;
  let isLoadingHighQuality = $state(false);
  let qualityLabel = $state("");
  let animationFrameId: number | null = null;
  let isPlaying = $state(false);

  function updateFrameCounter() {
    if (videoElement && onFrameUpdate) {
      frameUpdate();
    }

    // Continue animation loop if playing
    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateFrameCounter);
    }
  }

  export function togglePlay() {
    if (!videoElement) return;
    if (videoElement.paused) {
      videoElement.play();
      isPlaying = true;
      onTogglePlay(true);
      updateFrameCounter(); // Start RAF loop
    } else {
      videoElement.pause();
      isPlaying = false;
      onTogglePlay(false);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      // Update once more for accuracy
      if (onFrameUpdate) {
        frameUpdate();
      }
    }
  }

  function frameUpdate() {
    if (videoElement && onFrameUpdate) {
      onFrameUpdate(timeToFrame(videoElement.currentTime));
    }
  }

  function timeToFrame(time: number) {
    return Math.round(time * fps);
  }

  function frameToTime(frame: number) {
    // + 0.001 to account for browser rounding difference
    return (frame + 0.001) / fps;
  }

  export function seekToFrame(frame: number) {
    if (!videoElement) return;

    const wasPaused = videoElement.paused;

    // Pause if playing
    if (!videoElement.paused) {
      videoElement.pause();
    }

    // If video hasn't started yet, play briefly to load then pause
    if (videoElement.readyState < 2) {
      videoElement.play().then(() => {
        videoElement.currentTime = frameToTime(frame);
        videoElement.pause();
      });

      console.log("Video not ready, playing briefly to seek to frame:", frame);
      return;
    }

    // Seek to frame time
    videoElement.currentTime = frameToTime(frame);

    console.log("Seeking to frame:", frame);

    // If video was already paused, reload the current quality at the new position
    if (wasPaused && streamHandler) {
      streamHandler.reloadCurrentQuality();
    }
  }

  export function nextFrame(step: number = 1) {
    if (!videoElement) return;
    seekToFrame(Math.round(videoElement.currentTime * fps) + 1);
  }

  export function previousFrame(step: number = 1) {
    if (!videoElement) return;
    seekToFrame(Math.round(videoElement.currentTime * fps) - 1);
  }

  export function playbackRate(rate: number) {
    if (!videoElement) return;
    videoElement.playbackRate = rate;
  }

  export function setVolume(level: number) {
    if (!videoElement) return;
    videoElement.volume = level / 100;
    videoElement.muted = level === 0;
  }

  // Expose video element to parent
  $effect(() => {
    if (videoRef && videoElement) {
      videoRef.value = videoElement;
    }
  });

  onMount(() => {
    // Listen for play/pause events from video element
    const handlePlay = () => {
      isPlaying = true;
      onTogglePlay(true);
      updateFrameCounter(); // Start RAF loop
    };

    const handlePause = () => {
      isPlaying = false;
      onTogglePlay(false);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      // Update once more for accuracy
      if (onFrameUpdate) {
        frameUpdate();
      }
    };

    const handleSeeked = () => {
      // Update frame counter after seek completes
      if (onFrameUpdate) {
        frameUpdate();
      }
    };

    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);
    videoElement.addEventListener("seeked", handleSeeked);
    videoElement.addEventListener("resize", () => onResize());

    // Check if source is HLS (m3u8)
    const isHLS = src.toLowerCase().includes(".m3u8");

    if (isHLS) {
      // Initialize the video stream handler for HLS
      streamHandler = new VideoStreamHandler(videoElement, src, {
        initialFragmentCount: initialFragments,
        onLoadingChange: (loading: boolean, qualityInfo?: { label: string; height: number; width: number }) => {
          isLoadingHighQuality = loading;
          if (qualityInfo) {
            qualityLabel = qualityInfo.label;
          }
        },
      });
    } else {
      // For non-HLS sources, use native video element
      videoElement.src = src;
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      videoElement.removeEventListener("play", handlePlay);
      videoElement.removeEventListener("pause", handlePause);
      videoElement.removeEventListener("seeked", handleSeeked);
      if (streamHandler) {
        streamHandler.destroy();
      }
    };
  });
</script>

<div class="video-wrapper" bind:this={element}>
  <video bind:this={videoElement}>
    <track kind="captions" />
    Your browser does not support the video tag.
  </video>

  {#if isLoadingHighQuality}
    <div class="loader-overlay">
      <div class="quality-badge">
        <span class="quality-label">Loading: {qualityLabel}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  video {
    width: 100%;
    max-width: 100%;
  }

  .video-wrapper {
    position: relative;
    width: 100%;
  }

  .loader-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 10;
  }

  .quality-badge {
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(0, 0, 0, 0.3);
    padding: 8px 16px;
    border-radius: 20px;
    animation: slideIn 0.3s ease-out;
  }

  .quality-label {
    color: white;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }

  .quality-label::before {
    content: "●";
    color: rgba(255, 255, 255, 0.9);
    font-size: 8px;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes slideIn {
    from {
      transform: translateY(-10px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
</style>
