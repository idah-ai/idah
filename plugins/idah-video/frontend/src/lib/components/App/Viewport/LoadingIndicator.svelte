<script lang="ts">
  import { viewport } from "$lib/state/viewport.svelte";

  // ── Loading states ────────────────────────────────────────────────
  // highQuality: HLS is fetching a new quality fragment (written by Video.svelte
  //   via the VideoStreamHandler onLoadingChange callback).
  // framePending: the user requested a new frame (currentFrame changed) but the
  //   video element has not confirmed the seek yet (displayedFrame hasn't caught
  //   up). Suppressed during playback — the RAF loop keeps both in lockstep.
  let highQuality = $derived(viewport.video.loading.highQuality);
  let framePending = $derived(
    viewport.video.status === "pause" && viewport.video.currentFrame.value !== viewport.video.displayedFrame.value,
  );

  let visible = $derived(highQuality || framePending);

  // When both are active, the HQ label is more informative — prefer it.
  let label = $derived(highQuality ? `Loading: ${viewport.video.loading.qualityLabel}` : "Loading frame…");

  // ── Debounced display state ───────────────────────────────────────
  // `visible` toggles rapidly during key-hold navigation (true while the seek
  // is in-flight, false once seeked fires, true again on the next keypress).
  // Using {#if visible} directly destroys/recreates the DOM element each cycle,
  // restarting the CSS animation-delay and causing a visible flicker.
  //
  // Instead, `displayed` turns ON after 150 ms of continuous `visible` state,
  // ensuring fast buffered seeks never flash the indicator. Only genuinely slow
  // (network-bound) seeks show it. `displayed` turns OFF immediately when
  // `visible` goes false so the indicator hides promptly once loading completes.
  let displayed = $state(false);
  let showTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (visible) {
      if (!displayed && !showTimer) {
        showTimer = setTimeout(() => {
          displayed = true;
          showTimer = null;
        }, 150);
      }
    } else {
      if (showTimer) {
        clearTimeout(showTimer);
        showTimer = null;
      }
      displayed = false;
    }
    return () => {
      if (showTimer) clearTimeout(showTimer);
    };
  });
</script>

{#if displayed}
  <div class="loading-indicator" class:loading-indicator--active={visible}>
    <div class="loading-pill" aria-live="polite" aria-label={label}>
      <span class="loading-spinner" aria-hidden="true"></span>
      <span class="loading-text">{label}</span>
    </div>
  </div>
{/if}

<style>
  .loading-indicator {
    position: absolute;
    bottom: 8px;
    right: 8px;
    z-index: 100;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    /* Hidden until the active class is applied */
    opacity: 0;
  }

  .loading-indicator--active {
    opacity: 1;
  }

  .loading-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    padding: 8px 14px;
    border-radius: 20px;
    backdrop-filter: blur(4px);
  }

  .loading-spinner {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .loading-text {
    white-space: nowrap;
    line-height: 1.4;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
