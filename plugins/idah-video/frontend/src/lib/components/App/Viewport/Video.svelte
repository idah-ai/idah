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

  let videoElement: HTMLVideoElement;
  let streamHandler: VideoStreamHandler | undefined;

  let isPlaying = $state(false);
  let animationFrameId: number | null = $state(null);
  // One-shot rVFC token for a paused seek. Cancelled if another seek fires before
  // the frame is painted so only the latest seek updates displayedFrame.
  let pendingFrameCallbackId: number | null = null;
  // Set to the target frame *before* writing currentTime so the seeked handler
  // and the seek $effect can detect and discard stale / redundant events.
  let lastSeekedFrame = $state(-1);
  // Debounce timer that triggers an HLS HQ reload after the user stops seeking.
  let hlsReloadTimer: ReturnType<typeof setTimeout> | undefined;

  // ── Frame ↔ time helpers ─────────────────────────────────────────
  // The browser uses seconds; the rest of the app is 0-based frame indices.
  // Video is 1-based internally so frame 0 maps to t = 1/fps, not t = 0.
  function timeToFrame(t: number) {
    return Math.min(Math.round(t * fps), media.totalFrames) - 1;
  }
  function frameToTime(f: number) {
    return (f + 1 + 0.001) / fps;
  }

  // ── RAF loop (playback only) ──────────────────────────────────────
  // Runs while the video is playing. Updates currentFrame and displayedFrame
  // on every decoded frame so the timeline stays in sync with what is on screen.
  // Uses requestVideoFrameCallback (rVFC) when available — it fires once per
  // decoded frame, synchronized with the compositor, so there are no duplicate
  // or missed frames at mismatched display/video frame rates.
  // Falls back to requestAnimationFrame on unsupported browsers (slightly less
  // accurate but functionally equivalent).
  function startRAF() {
    if ("requestVideoFrameCallback" in videoElement) {
      const tick = (_now: number, metadata: VideoFrameCallbackMetadata) => {
        if (!videoElement) return;
        const frame = timeToFrame(metadata.mediaTime);
        viewport.video.currentFrame.value = frame;
        viewport.video.displayedFrame.value = frame;
        onFrameUpdate?.(frame);
        animationFrameId = (videoElement as any).requestVideoFrameCallback(tick);
      };
      animationFrameId = (videoElement as any).requestVideoFrameCallback(tick);
    } else {
      const tick = () => {
        if (!videoElement) return;
        const frame = timeToFrame(videoElement.currentTime);
        viewport.video.currentFrame.value = frame;
        viewport.video.displayedFrame.value = frame;
        onFrameUpdate?.(frame);
        animationFrameId = requestAnimationFrame(tick);
      };
      animationFrameId = requestAnimationFrame(tick);
    }
  }

  // Stops the active RAF/rVFC loop started by startRAF().
  function stopRAF() {
    if (animationFrameId == null) return;
    if ("cancelVideoFrameCallback" in videoElement) {
      (videoElement as any).cancelVideoFrameCallback(animationFrameId);
    } else {
      cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = null;
  }

  // ── Paused frame sync ─────────────────────────────────────────────
  // Called after every pause (manual, natural end, or programmatic).
  // Writes lastSeekedFrame first so the seek $effect skips the writeback and
  // does not cancel the in-flight HLS HQ render triggered by the pause event.
  // When the video ended naturally, reads duration rather than currentTime
  // because rVFC can lag 2–3 frames at high playback speeds.
  function syncPausedFrame() {
    const t = videoElement.ended ? videoElement.duration : videoElement.currentTime;
    const frame = timeToFrame(t);
    lastSeekedFrame = frame;
    viewport.video.currentFrame.value = frame;
    viewport.video.displayedFrame.value = frame;
    onFrameUpdate?.(frame);
  }

  // ── Play / pause effect ───────────────────────────────────────────
  // Reacts to viewport.video.status changes (set by the toolbar or keyboard
  // shortcuts). The actual DOM play()/pause() calls live here so that the
  // single source of truth (status) drives both the UI and the video element.
  //
  // Play flow:  status → "play"
  //   1. Cancel any pending HLS HQ reload (avoids a race where the 50 ms timer
  //      fires between play() and the "play" DOM event and snaps currentTime).
  //   2. Call videoElement.play() → browser fires "play" event.
  //   3. Start the RAF/rVFC tick loop.
  //
  // Pause flow: status → "pause"
  //   1. Call videoElement.pause() → browser fires "pause" event.
  //   2. Stop the RAF/rVFC loop.
  //   3. Sync the displayed frame to the exact paused position.
  const requestPlay = $derived(!isPlaying && viewport.video.status === "play");
  const requestPause = $derived(isPlaying && viewport.video.status === "pause");

  $effect(() => {
    if (!videoElement) return;

    if (requestPlay) {
      streamHandler?.cancelPendingRender();
      clearTimeout(hlsReloadTimer);
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
      if (videoElement) syncPausedFrame();
    }
  });

  // ── Seek effect (paused only) ─────────────────────────────────────
  // During playback the RAF loop owns frame position; this effect is a no-op
  // while isPlaying is true.
  //
  // Seek flow (paused):
  //   1. Detect a new target frame (currentFrame changed, differs from last seek).
  //   2. Set lastSeekedFrame before writing currentTime so later stale events
  //      can be discarded by the seeked handler and this effect itself.
  //   3. Update videoElement.currentTime to jump the decoder.
  //   4. Register a one-shot rVFC callback to update displayedFrame the instant
  //      the new frame is actually painted (more precise than the "seeked" event).
  //   5. Debounce an HLS HQ reload by 300 ms: while the user holds an arrow key
  //      the seeks stack rapidly (~30 ms apart); we reload only after they stop.
  $effect(() => {
    if (!videoElement || isPlaying) return;

    const target = viewport.video.currentFrame.value;
    if (target === lastSeekedFrame) return;

    lastSeekedFrame = target;
    videoElement.currentTime = frameToTime(target);

    // Update displayedFrame exactly when the compositor paints the decoded frame.
    if ("requestVideoFrameCallback" in videoElement) {
      if (pendingFrameCallbackId !== null) {
        (videoElement as any).cancelVideoFrameCallback(pendingFrameCallbackId);
      }
      pendingFrameCallbackId = (videoElement as any).requestVideoFrameCallback(
        (_now: number, metadata: VideoFrameCallbackMetadata) => {
          pendingFrameCallbackId = null;
          viewport.video.displayedFrame.value = timeToFrame(metadata.mediaTime);
        },
      );
    }

    if (streamHandler) {
      streamHandler.cancelPendingRender();
      clearTimeout(hlsReloadTimer);
      hlsReloadTimer = setTimeout(() => {
        if (videoElement.paused) streamHandler!.reloadCurrentQuality();
      }, 300);
    }
  });

  // ── Public API ────────────────────────────────────────────────────
  // All methods funnel through viewport.video.currentFrame so the seek $effect
  // and the RAF loop share a single authoritative position.

  // Jump directly to a frame index (0-based).
  export async function seekToFrame(frame: number) {
    viewport.video.goToFrame(frame);
  }

  // Set the playback speed multiplier (does not affect HLS quality switching).
  export function playbackRate(rate: number) {
    if (videoElement) videoElement.playbackRate = rate;
  }

  // Set the volume from a 0–100 percentage; 0 mutes the element.
  export function setVolume(level: number) {
    if (!videoElement) return;
    videoElement.volume = level / 100;
    videoElement.muted = level === 0;
    onVolumeChange(level, level === 0);
  }

  $effect(() => {
    if (videoRef && videoElement) videoRef.value = videoElement;
  });

  // ── Mount ─────────────────────────────────────────────────────────
  onMount(() => {
    videoElement.volume = 0;
    videoElement.muted = true;

    // "play" fires for both programmatic (videoElement.play()) and browser-native play.
    // Only update status — the $effect reacts and runs all side effects (startRAF, onTogglePlay, etc.)
    const handlePlay = () => {
      viewport.video.status = "play";
    };

    // "pause" fires for both programmatic (videoElement.pause()) and browser-native pause
    // (including natural end-of-video). Only update status so the $effect fires and handles
    // stopRAF / syncPausedFrame for both the programmatic and natural-end cases.
    const handlePause = () => {
      viewport.video.status = "pause";
    };

    const handleResize = () => onResize();
    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);
    videoElement.addEventListener("resize", handleResize);

    // HLS streams get a VideoStreamHandler that manages adaptive quality during
    // playback and switches to the highest quality level on every pause/seek.
    // endOfFrameTime is the exact timestamp of the last frame derived from the
    // database metadata (frameToTime(totalFrames - 1)). It is passed explicitly
    // because videoElement.duration reported by the browser can differ from the
    // database frame count due to HLS segmentation rounding — using it when the
    // video ends would cause HLS to start loading past the last fragment boundary
    // (a no-op), so FRAG_LOADED would never fire and the HQ frame would be skipped.
    // Plain video files are assigned directly to src.
    if (src?.toLowerCase().includes(".m3u8")) {
      streamHandler = new VideoStreamHandler(videoElement, src, {
        endOfFrameTime: frameToTime(media.totalFrames - 1),
        initialFragmentCount: initialFragments,
        onLoadingChange: (loading, info) => {
          viewport.video.loading.highQuality = loading;
          if (info) viewport.video.loading.qualityLabel = info.label;
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
      videoElement.removeEventListener("resize", handleResize);
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
</style>
