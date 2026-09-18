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
    canvas = undefined,
    onFrameUpdate = (_currentFrame: number) => {},
    onTogglePlay = (_playing: boolean) => {},
    onResize = () => {},
    onVolumeChange = (_level: number, _muted: boolean) => {},
  }: {
    src?: string;
    fps: number;
    initialFragments?: number;
    bind?: { value: HTMLVideoElement };
    canvas?: HTMLCanvasElement;
    onFrameUpdate?: (currentFrame: number) => void;
    onTogglePlay?: (playing: boolean) => void;
    onResize?: () => void;
    onVolumeChange?: (level: number, muted: boolean) => void;
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
  // Frames are 0-based; the browser works in seconds. Crucially, the media
  // timeline does NOT necessarily start at t=0: for HLS (MPEG-TS) hls.js rebases
  // the stream and leaves a sub-second residual, so frame 0 actually sits at
  // buffered.start(0) (≈0.021s here), not at zero. `startOffset` captures that
  // (see onMount) and anchors all frame↔time math to it; plain files start at 0,
  // so it stays 0. Without this anchor every paused seek lands one frame early —
  // frame 1 paints frame 0's pixels — because f/fps falls inside frame (f−1)'s
  // presentation interval [offset+(f−1)/fps, offset+f/fps).
  let startOffset = 0;
  // Index f maps to t = startOffset + f/fps (first frame at startOffset), plus a
  // tiny epsilon to land just inside the frame, clear of its boundary. Rounding
  // (not floor) maps a frame-aligned time straight back to its index, tolerating
  // the float error introduced by subtracting the offset.
  function timeToFrame(t: number) {
    return Math.max(0, Math.min(Math.round((t - startOffset) * fps), media.totalFrames - 1));
  }
  function frameToTime(f: number) {
    return startOffset + (f + 0.001) / fps;
  }

  // ── Canvas presentation ───────────────────────────────────────────
  // The <video> is a hidden decode source outside the zoom transform; each
  // presented frame is copied to the VideoCanvas surface inside it. drawImage
  // stretches to media dimensions (the old object-fit: fill) so the current
  // HLS level's intrinsic size doesn't matter.
  let ctx: CanvasRenderingContext2D | null = null;
  let presentLoopId: number | null = null;

  function drawFrame() {
    if (!ctx || !videoElement || videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    ctx.drawImage(videoElement, 0, 0, media.width, media.height);
    // Tells VideoCanvas to drop its loading placeholder.
    if (!viewport.video.hasRenderedFrame) viewport.video.hasRenderedFrame = true;
  }

  // Reacts to the prop, not onMount: the canvas binds later (VideoCanvas mounts
  // inside ShapesContainer). Reading ui.renderMode also repaints on mode toggle
  // — imageSmoothing scales decode→backing store, the .nearest class handles
  // backing store→screen.
  $effect(() => {
    if (!canvas) return;
    // Alpha on: an { alpha: false } context is opaque black from creation,
    // hiding the placeholder for the whole startup buffer. Video frames are
    // opaque anyway.
    if (!ctx) ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = ui.renderMode !== "nearest-neighbor";
    drawFrame();
  });

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
        drawFrame();
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

    // Always-on presentation chain: one draw per presented frame — playback,
    // paused seeks, and the HQ same-frame re-seek the seek $effect ignores
    // (lastSeekedFrame unchanged), which nothing else would repaint. Runs
    // alongside the playback tick loop; both fire for the same presented frame,
    // so pixels and displayedFrame stay in step.
    if (hasRVFC) {
      const present = () => {
        drawFrame();
        presentLoopId = (videoElement as any).requestVideoFrameCallback(present);
      };
      presentLoopId = (videoElement as any).requestVideoFrameCallback(present);
    }

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
      // Repaint on every paused seek, rVFC or not: at startup the presentation
      // chain can fire before the canvas context exists, and a hidden paused
      // video may never present again — so the chain alone can miss the initial
      // frame and the HQ flush re-seek. If pixels race the event, the chain
      // corrects on its next callback.
      drawFrame();
      if (hasRVFC) return;
      // Paint before confirming, so overlays never lead the pixels.
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

    // Repaint when the element becomes renderable again while paused. Initial
    // load and HQ flushes end in a readyState climb that can land after
    // `seeked`, whose draw would then have no-oped. Playback draws via the loops.
    const handleCanPlay = () => {
      if (!isPlaying) drawFrame();
    };

    // Anchor the frame↔time helpers to the real media start (see startOffset).
    // `loadeddata` guarantees the first frame's data is appended, so buffered
    // holds the true frame-0 time; detach once captured (it never changes).
    const handleLoadedData = () => {
      // Initial-frame paint: the presentation chain may have already fired (and
      // no-oped) before the context existed. Ahead of the buffered guard, which
      // is about startOffset capture, not drawing.
      drawFrame();
      if (videoElement.buffered.length === 0) return;
      startOffset = videoElement.buffered.start(0);
      videoElement.removeEventListener("loadeddata", handleLoadedData);
    };

    const handleResize = () => onResize();
    videoElement.addEventListener("seeked", handleSeeked);
    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);
    videoElement.addEventListener("waiting", handleWaiting);
    videoElement.addEventListener("playing", handlePlaying);
    videoElement.addEventListener("canplay", handleCanPlay);
    videoElement.addEventListener("loadeddata", handleLoadedData);
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
    } else if (src) {
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
      if (presentLoopId !== null && hasRVFC) {
        (videoElement as any).cancelVideoFrameCallback(presentLoopId);
        presentLoopId = null;
      }
      // Clear buffering so a stale true can't keep the pill up on the next video.
      viewport.video.loading.buffering = false;
      // Re-arm the loading placeholder for the next video.
      viewport.video.hasRenderedFrame = false;
      videoElement.removeEventListener("seeked", handleSeeked);
      videoElement.removeEventListener("play", handlePlay);
      videoElement.removeEventListener("pause", handlePause);
      videoElement.removeEventListener("waiting", handleWaiting);
      videoElement.removeEventListener("playing", handlePlaying);
      videoElement.removeEventListener("canplay", handleCanPlay);
      videoElement.removeEventListener("loadeddata", handleLoadedData);
      videoElement.removeEventListener("resize", handleResize);
      streamHandler?.destroy();
    };
  });
</script>

<!--
  Hidden decode/audio source, rendered OUTSIDE the zoomable Viewport target so
  the compositor never scales it. Frames are presented on VideoCanvas instead.
-->
<video class="video-source" bind:this={videoElement}>
  <track kind="captions" />
  Your browser does not support the video tag.
</video>

<style>
  /* opacity: 0, never display:none or visibility:hidden — those drop the
     element from the paint pipeline and can stall requestVideoFrameCallback.
     Sized to the section (not media pixels): drawImage samples the decoded
     frame at intrinsic resolution, so the CSS box has no effect on output. */
  .video-source {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    pointer-events: none;
  }
</style>
