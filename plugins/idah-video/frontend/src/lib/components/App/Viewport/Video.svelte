<script lang="ts">
  import { onMount } from "svelte";
  import { VideoStreamHandler } from "./video-stream-handler.ts";
  import { media } from "$lib/state/media.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  import { ui } from "$lib/state/ui.svelte";

  let {
    src = undefined,
    fps,
    initialFragments = 3,
    bind: videoRef = undefined,
    element = $bindable(),
    onFrameUpdate = (_currentFrame: number) => {},
    onTogglePlay = (_playing: boolean) => {},
    onResize = () => {},
    onVolumeChange = (_level: number, _muted: boolean) => {},
  } = $props();

  // ── Element refs ──────────────────────────────────────────────────
  let videoElement: HTMLVideoElement;
  let streamHandler: VideoStreamHandler | undefined;

  // ── UI state ───────────────────────────────────────────────────────
  let isLoadingHighQuality = $state(false);
  let qualityLabel = $state("");
  let isPlaying = $state(false);
  let animationFrameId: number | null = $state(null);

  // ── Loop guard ─────────────────────────────────────────────────────
  // Tracks the last frame that was actually seeked to on the <video> element.
  // Prevents the seek effect from re-triggering when handleSeeked writes back
  // the (slightly rounded) frame from videoElement.currentTime.
  let lastSeekedFrame = $state(-1);
  let hlsReloadTimer: ReturnType<typeof setTimeout> | undefined;

  // ── Helpers ────────────────────────────────────────────────────────
  // Video is 1-based (frame 1 = 1/fps sec), data/timeline is 0-based.
  function timeToFrame(t: number) {
    return Math.round(t * fps) - 1;
  }
  function frameToTime(f: number) {
    return (f + 1 + 0.001) / fps;
  }

  // ── RAF loop (only runs while playing) ─────────────────────────────
  function startRAF() {
    if ("requestVideoFrameCallback" in videoElement) {
      const tick = (_now: number, metadata: VideoFrameCallbackMetadata) => {
        if (!videoElement) return;
        const frame = timeToFrame(metadata.mediaTime);
        viewport.video.currentFrame.value = frame;
        onFrameUpdate?.(frame);
        animationFrameId = (videoElement as any).requestVideoFrameCallback(tick);
      };
      animationFrameId = (videoElement as any).requestVideoFrameCallback(tick);
    } else {
      // Fallback for browsers without rVFC support
      const tick = () => {
        if (!videoElement) return;
        const frame = timeToFrame(videoElement.currentTime);
        viewport.video.currentFrame.value = frame;
        onFrameUpdate?.(frame);
        animationFrameId = requestAnimationFrame(tick);
      };
      animationFrameId = requestAnimationFrame(tick);
    }
  }

  function stopRAF() {
    if (animationFrameId != null) {
      if ("cancelVideoFrameCallback" in videoElement) {
        (videoElement as any).cancelVideoFrameCallback(animationFrameId);
      } else {
        cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = null;
    }
  }

  // ── Derived play/pause requests ───────────────────────────────────
  const requestPlay = $derived(!isPlaying && viewport.video.status === "play");
  const requestPause = $derived(isPlaying && viewport.video.status === "pause");

  // ── Effect: play/pause ────────────────────────────────────────────
  $effect(() => {
    if (!videoElement) return;

    if (requestPlay) {
      videoElement.play();
      isPlaying = true;
      onTogglePlay(true);
      startRAF();
    }

    if (requestPause) {
      videoElement.pause();
      isPlaying = false;
      onTogglePlay(false);
      stopRAF();
      // Final frame read (exact post-pause position).
      // Sync lastSeekedFrame BEFORE writing back so the seek $effect sees
      // target === lastSeekedFrame and returns early — preventing it from
      // calling cancelRender() on the in-flight HQ render.
      if (videoElement) {
        const frame = timeToFrame(videoElement.currentTime);
        lastSeekedFrame = frame;
        viewport.video.currentFrame.value = frame;
        onFrameUpdate?.(frame);
      }
    }
  });

  // ── Effect: seek ──────────────────────────────────────────────────
  // When paused and the user changes viewport.video.currentFrame.value
  // (timeline click, keyboard shortcut, etc.), seek the <video> element.
  // Guarded by lastSeekedFrame to ignore writebacks from handleSeeked.
  // During playback the RAF loop owns the frame position — bail out.
  $effect(() => {
    if (!videoElement || isPlaying) return;

    let target = viewport.video.currentFrame.value;
    if (target === lastSeekedFrame) return;

    const delta = Math.abs(target - lastSeekedFrame);
    lastSeekedFrame = target;

    videoElement.currentTime = frameToTime(target);

    if (streamHandler) {
      clearTimeout(hlsReloadTimer);
      // Single-step (keyboard arrow, nextFrame/prevFrame): reload quickly.
      // Rapid scrub (slider drag, large jump): wait for activity to settle.
      const debounceMs = delta <= 2 ? 10 : 150;
      hlsReloadTimer = setTimeout(() => {
        if (videoElement.paused) streamHandler!.reloadCurrentQuality();
      }, debounceMs);
    }
  });

  // ── Exported API ─────────────────────────────────────────────────
  export async function seekToFrame(frame: number) {
    viewport.video.currentFrame.value = frame;
  }

  export function togglePlay() {
    if (!videoElement) return;
    if (videoElement.paused) viewport.video.play();
    else viewport.video.pause();
  }

  export function nextFrame(step = 1) {
    const current = viewport.video.currentFrame.value;
    viewport.video.currentFrame.value = current + step;
  }

  export function previousFrame(step = 1) {
    const current = viewport.video.currentFrame.value;
    viewport.video.currentFrame.value = current - step;
  }

  export function playbackRate(rate: number) {
    if (videoElement) videoElement.playbackRate = rate;
  }

  export function setVolume(level: number) {
    if (!videoElement) return;
    videoElement.volume = level / 100;
    videoElement.muted = level === 0;
    onVolumeChange(level, level === 0);
  }

  // Expose raw <video> element to parent
  $effect(() => {
    if (videoRef && videoElement) videoRef.value = videoElement;
  });

  // ── Mount ─────────────────────────────────────────────────────────
  onMount(() => {
    videoElement.volume = 0;
    videoElement.muted = true;

    const handlePlay = () => {
      // Browser initiated play (e.g. right-click → play). Sync upward.
      isPlaying = true;
      viewport.video.status = "play";
      onTogglePlay(true);
      startRAF();
    };

    const handlePause = () => {
      isPlaying = false;
      viewport.video.status = "pause";
      onTogglePlay(false);
      stopRAF();
      // Final frame read.
      // Sync lastSeekedFrame BEFORE writing back so the seek $effect sees
      // target === lastSeekedFrame and returns early — preventing it from
      // calling cancelRender() on the in-flight HQ render.
      if (videoElement) {
        const frame = timeToFrame(videoElement.currentTime);
        lastSeekedFrame = frame;
        viewport.video.currentFrame.value = frame;
        onFrameUpdate?.(frame);
      }
    };

    const handleSeeked = () => {
      // Only write back when paused — during play the RAF loop owns the frame.
      if (!isPlaying && videoElement) {
        const frame = timeToFrame(videoElement.currentTime);
        viewport.video.currentFrame.value = frame;
        lastSeekedFrame = frame; // keep guard in sync
        onFrameUpdate?.(frame);
      }
    };

    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);
    videoElement.addEventListener("seeked", handleSeeked);
    videoElement.addEventListener("resize", () => onResize());

    const isHLS = src?.toLowerCase().includes(".m3u8");

    if (isHLS) {
      streamHandler = new VideoStreamHandler(videoElement, src, {
        initialFragmentCount: initialFragments,
        onLoadingChange: (loading, info) => {
          isLoadingHighQuality = loading;
          if (info) qualityLabel = info.label;
        },
      });
    } else {
      videoElement.src = src;
    }

    return () => {
      stopRAF();
      clearTimeout(hlsReloadTimer);
      videoElement.removeEventListener("play", handlePlay);
      videoElement.removeEventListener("pause", handlePause);
      videoElement.removeEventListener("seeked", handleSeeked);
      streamHandler?.destroy();
    };
  });
</script>

<div class="video-wrapper" style="width: {media.width}px; height: {media.height}px;" bind:this={element}>
  <div class="video-placeholder"></div>

  <video
    class={["video-element", ui.renderMode === "nearest-neighbor" ? "nearest" : ""].join(" ")}
    bind:this={videoElement}
  >
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
  .video-element {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    position: relative;
    z-index: 1;
    object-fit: fill;
  }

  .video-element.nearest,
  .placeholder-image.nearest {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .video-wrapper {
    position: relative;
    background-color: #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .video-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 0;
  }

  .placeholder-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
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
    content: "\25CF";
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
