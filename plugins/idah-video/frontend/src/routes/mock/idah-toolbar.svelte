<script lang="ts">
  // -----------------------------------------------------------------------
  // IdahToolbar.svelte — Renders V2 toolbar items + built-in undo/redo
  // -----------------------------------------------------------------------
  import type { IToolbarItem } from "$idah/v2/types";

  import undoIcon from "$lib/assets/icons/undo.svg?raw";
  import redoIcon from "$lib/assets/icons/redo.svg?raw";

  interface Props {
    items: IToolbarItem[];
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
  }
  let { items, onUndo, onRedo, canUndo = false, canRedo = false }: Props = $props();
</script>

<div class="mock-toolbar">
  <div class="toolbar-group">
    <button class="toolbar-btn" disabled={!canUndo} onclick={onUndo} title="Undo">
      {@html undoIcon}
    </button>
    <button class="toolbar-btn" disabled={!canRedo} onclick={onRedo} title="Redo">
      {@html redoIcon}
    </button>
  </div>

  <div class="toolbar-divider"></div>

  <div class="toolbar-group">
    {#each items as item}
      <button
        class="toolbar-btn"
        class:toggled={item.whenToggled?.() ?? false}
        onclick={item.onClick}
        title={item.label}
      >
        {@html item.icon}
      </button>
    {/each}
  </div>
</div>

<style>
  .mock-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--background, #f8f9fa);
    border-bottom: 1px solid var(--border, #dee2e6);
  }
  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .toolbar-divider {
    width: 1px;
    height: 24px;
    background: var(--border, #dee2e6);
    margin: 0 4px;
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
