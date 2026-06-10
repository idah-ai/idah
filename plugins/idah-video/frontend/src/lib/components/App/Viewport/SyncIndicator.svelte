<script lang="ts">
  import { syncStatus, retrySync, resetSync } from "$lib/state/driver.svelte";

  let visible = $derived(syncStatus.queued > 0 || syncStatus.error !== null);
</script>

{#if visible}
  <div class="sync-indicator">
    {#if syncStatus.error}
        <div class="sync-banner sync-banner--error" role="alert" aria-live="assertive">
          <span class="sync-text">
            {syncStatus.error.message} ({syncStatus.error.code})
            <span class="sync-attempts">({syncStatus.error.failedCount} attempt{syncStatus.error.failedCount === 1 ? "" : "s"})</span>
            <span class="sync-risk">Your changes might not be saved</span>
          </span>
          <span class="sync-actions">
            <button
              class="sync-btn sync-btn--ghost"
              onclick={retrySync}
              title="Retry sending pending changes"
            >Retry</button>
            <button
              class="sync-btn sync-btn--solid"
              onclick={resetSync}
              title="Discard local changes and reload from the server"
            >Reset</button>
          </span>
        </div>
    {:else}
      <div class="sync-loading" aria-live="polite" aria-label="Syncing {syncStatus.queued} item{syncStatus.queued === 1 ? '' : 's'}">
        <span class="sync-spinner" aria-hidden="true"></span>
        <span class="sync-text">Syncing {syncStatus.queued} item{syncStatus.queued === 1 ? "" : "s"}…</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .sync-indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 100;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    max-width: 520px;
  }

  /* ── Shared banner layout ─────────────────────────────────────────── */

  .sync-banner {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 10px 8px 14px;
    border-radius: 12px;
    backdrop-filter: blur(4px);
    line-height: 1.4;
  }

  .sync-banner--error {
    background: rgba(185, 28, 28, 0.92);
    color: #fff;
  }

  .sync-text {
    flex: 1;
  }

  .sync-attempts {
    margin-left: 4px;
    opacity: 0.7;
    font-size: 11px;
  }

  /* Shown on a new line below the main message. */
  .sync-risk {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    opacity: 0.8;
    font-style: italic;
  }

  /* ── Actions ──────────────────────────────────────────────────────── */

  .sync-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    align-self: center;
    margin-left: 4px;
  }

  .sync-btn {
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    padding: 3px 10px;
    transition: opacity 0.15s, background 0.15s;
    white-space: nowrap;
    line-height: 1.6;
  }

  /* Solid white — primary action for server errors (Reset). */
  .sync-btn--solid {
    background: #fff;
    color: rgba(185, 28, 28, 0.95);
  }

  .sync-btn--solid:hover {
    opacity: 0.88;
  }

  /* Ghost — secondary action for server errors (Retry). */
  .sync-btn--ghost {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
  }

  .sync-btn--ghost:hover {
    background: rgba(255, 255, 255, 0.28);
  }

  /* ── Loading ──────────────────────────────────────────────────────── */

  .sync-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    padding: 8px 14px;
    border-radius: 20px;
    backdrop-filter: blur(4px);
  }

  .sync-spinner {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
