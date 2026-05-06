<script lang="ts">
  // -----------------------------------------------------------------------
  // IdahToolbar.svelte — Renders toolbar items from the V2 toolbar manager
  // -----------------------------------------------------------------------
  import type { IToolbarItem } from "$idah/v2/types";

  interface Props {
    items: IToolbarItem[];
  }
  let { items }: Props = $props();
</script>

<div class="mock-toolbar">
  {#each items as item}
    <button
      class="toolbar-btn"
      class:toggled={item.whenToggled()}
      onclick={item.onClick}
      title="Mode: {item.mode} | Group: {item.group ?? '(always)'}"
    >
      {@html item.icon}
    </button>
  {/each}
</div>

<style>
  .mock-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--background, #f8f9fa);
    border-bottom: 1px solid var(--border, #dee2e6);
    flex-wrap: wrap;
  }
  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    color: var(--foreground, #495057);
    transition: background 0.15s, border-color 0.15s;
  }
  .toolbar-btn:hover {
    background: var(--accent, #e9ecef);
  }
  .toolbar-btn.toggled {
    background: var(--primary, #0d6efd);
    color: #fff;
    border-color: var(--primary, #0d6efd);
  }
</style>
