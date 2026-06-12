<script lang="ts">
  import { viewport } from "$lib/state/viewport.svelte";

  let highQuality = $derived(viewport.video.loading.highQuality);
  let framePending = $derived(viewport.video.framePending);
  // The reduced-detail badge only makes sense while paused (the handler can't
  // track the moving playhead during playback) and yields to the two transient
  // indicators, which already imply or supersede it.
  let lowQualityFrame = $derived(
    viewport.video.loading.lowQualityFrame && viewport.video.status === "pause" && !highQuality && !framePending,
  );

  let visible = $derived(highQuality || framePending || lowQualityFrame);
  let label = $derived(highQuality ? `Loading: ${viewport.video.loading.qualityLabel}` : "Loading Frame");

  // ── Debounced display state ───────────────────────────────────────
  // Turns ON after 150 ms of continuous `visible` so fast buffered seeks
  // never flash the indicator. Turns OFF immediately once loading clears.
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
    {#if highQuality}
      <!-- Image icon with animated stripes; hover reveals the quality label -->
      <div class="loading-image" aria-label={label} role="status">
        <div class="image-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21,15 16,10 5,21"/>
          </svg>
          <div class="stripe-overlay"></div>
        </div>
        <span class="image-label">{label}</span>
      </div>
    {:else if framePending}
      <!-- Subtle pill for frame seek -->
      <div class="loading-pill" aria-live="polite" aria-label={label} role="status">
        <span class="loading-spinner" aria-hidden="true"></span>
        <span class="loading-text">Loading Frame</span>
      </div>
    {:else}
      <!-- Persistent badge: the frame on screen is low quality (slow network);
           it stays until the HQ replacement lands -->
      <div class="lq-badge" aria-label="Low quality frame" role="status" title="Low quality frame — full quality loads when the network allows">
        LQ
      </div>
    {/if}
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
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .loading-indicator--active {
    opacity: 1;
  }

  /* ── Frame loading pill ─────────────────────────────────────────── */
  .loading-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    background: rgba(0, 0, 0, 0.4);
    color: rgba(255, 255, 255, 0.7);
    padding: 4px 9px;
    border-radius: 10px;
  }

  .loading-spinner {
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    border-top-color: rgba(255, 255, 255, 0.65);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  .loading-text {
    white-space: nowrap;
    line-height: 1.4;
  }

  /* ── Low-quality frame badge ────────────────────────────────────── */
  .lq-badge {
    background: rgba(0, 0, 0, 0.45);
    color: rgba(255, 200, 80, 0.9);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 3px 6px;
    border-radius: 6px;
    pointer-events: auto;
    cursor: default;
  }

  /* ── Quality loading image badge ────────────────────────────────── */
  .loading-image {
    display: flex;
    align-items: center;
    overflow: hidden;
    /* icon-only collapsed state */
    max-width: 26px;
    background: rgba(0, 0, 0, 0.35);
    border-radius: 6px;
    padding: 3px;
    pointer-events: auto;
    cursor: default;
    transition: max-width 0.25s ease, padding 0.25s ease, background 0.2s ease;
  }

  .loading-image:hover {
    max-width: 220px;
    padding: 3px 9px 3px 3px;
    background: rgba(0, 0, 0, 0.55);
  }

  .image-icon {
    position: relative;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    overflow: hidden;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
  }

  .image-icon svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Diagonal moving stripes over the icon */
  .stripe-overlay {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      -45deg,
      transparent 0px,
      transparent 3px,
      rgba(255, 255, 255, 0.18) 3px,
      rgba(255, 255, 255, 0.18) 6px
    );
    background-size: 12px 12px;
    animation: stripe-move 0.55s linear infinite;
  }

  /* Label hidden until hover expands the badge */
  .image-label {
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.8);
    font-size: 11px;
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    transition: max-width 0.25s ease, opacity 0.15s ease 0.08s, margin-left 0.25s ease;
    margin-left: 0;
  }

  .loading-image:hover .image-label {
    max-width: 180px;
    opacity: 1;
    margin-left: 6px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes stripe-move {
    to { background-position: 12px 12px; }
  }
</style>
