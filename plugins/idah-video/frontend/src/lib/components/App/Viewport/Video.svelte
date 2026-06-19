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
  let animationFrameId: number | null = null;
  // One-shot rVFC token for a paused seek; cancelled if a newer seek fires first.
  let pendingFrameCallbackId: number | null = null;
  // Last target frame; set before writing currentTime so the seek $effect can
  // discard stale/redundant events.
  let lastSeekedFrame = -1;
  // Whether requestVideoFrameCallback is supported. Cached at mount (an inline
  // `in` guard would narrow videoElement to `never` and break .currentTime use).
  let hasRVFC = false;

  // ── Frame ↔ time helpers ─────────────────────────────────────────
  // Frames are 0-based; the browser uses seconds. Index f maps to t = f/fps
  // (first frame at t=0), plus a tiny epsilon to avoid frame/fragment boundaries.
  function timeToFrame(t: number) {
    return Math.max(0, Math.min(Math.round(t * fps), media.totalFrames - 1));
  }
  function frameToTime(f: number) {
    return (f + 0.001) / fps;
  }

  // ── RAF loop (playback only) ──────────────────────────────────────
  // While playing, syncs currentFrame/displayedFrame to the on-screen frame.
  // Prefers rVFC (one callback per decoded frame, compositor-synced); falls back
  // to requestAnimationFrame where unsupported.
  function startRAF() {
    if (hasRVFC) {
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
    if (hasRVFC) {
      (videoElement as any).cancelVideoFrameCallback(animationFrameId);
    } else {
      cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = null;
  }

  // ── Paused frame sync ─────────────────────────────────────────────
  // Runs after every pause. Sets lastSeekedFrame first so the seek $effect skips
  // its writeback (and won't cancel the pause-triggered HQ render). Uses duration
  // (not currentTime) when ended, since rVFC can lag a few frames at high speed.
  function syncPausedFrame() {
    const t = videoElement.ended ? videoElement.duration : videoElement.currentTime;
    const frame = timeToFrame(t);
    lastSeekedFrame = frame;
    // Re-seek so the decoder repaints exactly `frame`: the pixels frozen at pause
    // lag the clock (rVFC trails currentTime by 1–3 frames), and without this snap
    // the stale frame lingers until the HQ upgrade re-seeks, causing a visible
    // jump. The seek $effect is a no-op here (currentFrame === lastSeekedFrame).
    // Skipped when ended to preserve the duration handling above.
    if (!videoElement.ended) videoElement.currentTime = frameToTime(frame);
    viewport.video.currentFrame.value = frame;
    viewport.video.displayedFrame.value = frame;
    onFrameUpdate?.(frame);
  }

  // ── Play / pause effect ───────────────────────────────────────────
  // Drives the DOM play()/pause() from viewport.video.status (single source of
  // truth). Play: cancel any pending HQ reload (else its settle timer could snap
  // currentTime mid-play), play, start the tick loop. Pause: pause, stop the loop,
  // snap the displayed frame to the paused position.
  $effect(() => {
    if (!videoElement) return;

    if (!isPlaying && viewport.video.status === "play") {
      streamHandler?.cancelPendingRender();
      videoElement.play();
      isPlaying = true;
      onTogglePlay(true);
      startRAF();
    }

    if (isPlaying && viewport.video.status === "pause") {
      videoElement.pause();
      isPlaying = false;
      onTogglePlay(false);
      stopRAF();
      // A stall while playing may have left buffering latched; clear it so the
      // "Loading Frame" pill doesn't linger after we hand control back to seeks.
      viewport.video.loading.buffering = false;
      if (viewport.video.pauseForSeek) {
        // Navigation-initiated pause: don't snap to the playback clock (that
        // would clobber the requested target). Re-seed lastSeekedFrame to the
        // frame the element is actually parked on (displayedFrame, kept current
        // by the RAF loop) so the seek $effect re-fires and drives to the target
        // — and correctly no-ops if the user navigated to the playing frame.
        viewport.video.pauseForSeek = false;
        lastSeekedFrame = viewport.video.displayedFrame.value;
      } else if (videoElement) {
        syncPausedFrame();
      }
    }
  });

  // ── Seek effect (paused only) ─────────────────────────────────────
  // No-op while playing (the RAF loop owns position). On a new target frame:
  // record it, seek the decoder, confirm displayedFrame once the frame paints
  // (rVFC), and let loadQuality decide any quality work for the new position.
  $effect(() => {
    if (!videoElement || isPlaying) return;

    const target = viewport.video.currentFrame.value;
    if (target === lastSeekedFrame) return;

    // First run (lastSeekedFrame === -1) positions the element but skips
    // loadQuality, leaving the startup HQ load (FRAG_LOADED handler) undisturbed.
    const isInitSeeked = lastSeekedFrame === -1;
    lastSeekedFrame = target;
    videoElement.currentTime = frameToTime(target);

    // Confirm displayedFrame once the compositor paints. Uses the captured
    // `target`, not timeToFrame(mediaTime): an off-grid PTS can round to a
    // neighbouring index and latch framePending (stuck "Loading Frame" pill).
    // A newer seek cancels this callback, so `target` always matches the paint.
    if (hasRVFC) {
      if (pendingFrameCallbackId !== null) {
        (videoElement as any).cancelVideoFrameCallback(pendingFrameCallbackId);
      }
      pendingFrameCallbackId = (videoElement as any).requestVideoFrameCallback(
        (_now: number, _metadata: VideoFrameCallbackMetadata) => {
          pendingFrameCallbackId = null;
          viewport.video.displayedFrame.value = target;
        },
      );
    }

    if (!isInitSeeked) streamHandler?.loadQuality(frameToTime(target));
  });

  // ── Public API ────────────────────────────────────────────────────
  // All methods funnel through viewport.video.currentFrame so the seek $effect
  // and the RAF loop share a single authoritative position.

  // Jump directly to a frame index (0-based).
  export function seekToFrame(frame: number) {
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
    hasRVFC = "requestVideoFrameCallback" in videoElement;

    // play/pause fire for both programmatic and native (incl. natural end) cases.
    // Only set status; the $effect runs the side effects (startRAF, syncPausedFrame…).
    const handlePlay = () => {
      viewport.video.status = "play";
    };
    const handlePause = () => {
      viewport.video.status = "pause";
    };

    // Seek confirmation for browsers without rVFC. Skipped where rVFC exists:
    // `seeked` fires before the compositor paints, so it would briefly show
    // frame N's overlays over frame N−1's pixels. Confirms lastSeekedFrame (the
    // frame we asked for), not timeToFrame(currentTime) — the browser clamps
    // past-end seeks, and the clamped time would round to a smaller index and
    // latch framePending. renderHQAt's same-value re-seek also fires this, but
    // lastSeekedFrame is unchanged so it's idempotent.
    const handleSeeked = () => {
      if (isPlaying) return;
      if (hasRVFC) return;
      viewport.video.displayedFrame.value =
        lastSeekedFrame >= 0 ? lastSeekedFrame : timeToFrame(videoElement.currentTime);
    };

    // Playback stall feedback. `waiting` fires when playback halts for lack of
    // buffered data; light the buffering flag (which drives the "Loading Frame"
    // pill) only while playing — a paused seek can also emit `waiting`, but that
    // case is already covered by framePending and must not set this. `playing`
    // fires when playback resumes after the stall, so clear it there.
    const handleWaiting = () => {
      if (isPlaying) viewport.video.loading.buffering = true;
    };
    const handlePlaying = () => {
      viewport.video.loading.buffering = false;
    };

    const handleResize = () => onResize();
    videoElement.addEventListener("seeked", handleSeeked);
    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);
    videoElement.addEventListener("waiting", handleWaiting);
    videoElement.addEventListener("playing", handlePlaying);
    videoElement.addEventListener("resize", handleResize);

    // HLS streams get a VideoStreamHandler (HQ buffering while paused, adaptive
    // during playback). endOfFrameTime is the DB-derived last-frame time; it's
    // passed explicitly because browser duration can exceed it (HLS rounding),
    // which would make the end-of-video HQ load seek past the last fragment and
    // never fire FRAG_LOADED. Plain files are assigned straight to src.
    if (src?.toLowerCase().includes(".m3u8")) {
      streamHandler = new VideoStreamHandler(videoElement, src, {
        endOfFrameTime: frameToTime(media.totalFrames - 1),
        initialFragmentCount: initialFragments,
        onLoadingChange: (loading, info) => {
          viewport.video.loading.highQuality = loading;
          if (info) viewport.video.loading.qualityLabel = info.label;
        },
        onFragmentInFlightChange: (inFlight) => {
          viewport.video.setFragmentInFlight(inFlight);
        },
      });
    } else {
      videoElement.src = src;
    }

    return () => {
      stopRAF();
      // The seek effect's one-shot rVFC is separate from the playback loop;
      // cancel it too so it can't write displayedFrame after unmount.
      if (pendingFrameCallbackId !== null && hasRVFC) {
        (videoElement as any).cancelVideoFrameCallback(pendingFrameCallbackId);
        pendingFrameCallbackId = null;
      }
      // Clear buffering so a stale true can't keep the pill up on the next video.
      viewport.video.loading.buffering = false;
      videoElement.removeEventListener("seeked", handleSeeked);
      videoElement.removeEventListener("play", handlePlay);
      videoElement.removeEventListener("pause", handlePause);
      videoElement.removeEventListener("waiting", handleWaiting);
      videoElement.removeEventListener("playing", handlePlaying);
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
