<script lang="ts">
  import { syncStatus, dismissSyncError } from "$lib/state/driver.svelte";

  let visible = $derived(syncStatus.queued > 0 || syncStatus.error !== null);
</script>

{#if visible}
  <div class="sync-indicator">
    {#if syncStatus.error}
      <div class="sync-error" role="alert">
        <span class="sync-icon">⚠</span>
        <span class="sync-text">
          Sync failed: {syncStatus.error.message}
          {#if syncStatus.error.failedCount}
            ({syncStatus.error.failedCount} item(s))
          {/if}
        </span>
        <button
          class="sync-dismiss"
          onclick={dismissSyncError}
          title="Dismiss"
        >✕</button>
      </div>
    {:else}
      <div class="sync-loading">
        <span class="sync-spinner"></span>
        <span class="sync-text">
          Syncing {syncStatus.queued} item(s)…
        </span>
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
  }

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

  .sync-error {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(220, 38, 38, 0.85);
    color: #fff;
    padding: 8px 14px;
    border-radius: 20px;
    backdrop-filter: blur(4px);
  }

  .sync-spinner {
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

  .sync-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .sync-text {
    white-space: nowrap;
  }

  .sync-dismiss {
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    padding: 0 2px;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .sync-dismiss:hover {
    opacity: 1;
  }
</style>
