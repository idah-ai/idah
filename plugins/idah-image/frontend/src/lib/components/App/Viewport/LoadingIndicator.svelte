<script lang="ts">
  import { data } from "$lib/state/data.svelte";

  // `pending` is true for the whole initial range fetch; on a cold cache the
  // driver streams pages in via onBatch, so `items.length` climbs while this
  // stays visible — giving a live "N loaded so far" count.
  let loading = $derived(data.annotations?.pending ?? false);
</script>

{#if loading}
  <div class="load-indicator">
    <div class="load-loading">
      <span class="load-spinner"></span>
      <span class="load-text"> Loading Annotations… </span>
    </div>
  </div>
{/if}

<style>
  .load-indicator {
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
  }

  .load-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    padding: 8px 14px;
    border-radius: 20px;
    backdrop-filter: blur(4px);
  }

  .load-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .load-text {
    white-space: nowrap;
  }
</style>
