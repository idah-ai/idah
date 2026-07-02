<script lang="ts">
  import { tick } from "svelte";

  import {
    contextMenuState,
    hideContextMenu,
  } from "$lib/components/App/ContextMenu/store";

  // Variables
  let { visible, component: ContextMenuComponent, props } = $derived($contextMenuState);

  // Calculate if menu should be positioned to the left/bottom to stay in viewport
  const [offsetX, offsetY] = [16, 16];
  let contextMenuEl = $state<HTMLDivElement | null>(null);
  let clampedX = $state(0);
  let clampedY = $state(0);

  // Functions
  function handleOnContextMenu(e: MouseEvent) {
    e.preventDefault();
    hideContextMenu();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      hideContextMenu();
    }
  }

  $effect(() => {
    const { visible, x, y } = $contextMenuState;

    if (visible) {
      // Wait for DOM to paint so we can measure contextMenuEl
      tick().then(() => {
        if (!contextMenuEl) return;

        const { offsetWidth: contextMenuWidth, offsetHeight: contextMenuHeight } = contextMenuEl;

        clampedX = Math.max(0, Math.min(x, window.innerWidth - contextMenuWidth - offsetX));
        clampedY = Math.max(0, Math.min(y, window.innerHeight - contextMenuHeight - offsetY));
      });
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if visible && ContextMenuComponent}
  <div
    role="dialog"
    aria-modal="true"
    tabindex="0"
    class="fixed top-0 left-0 z-100 h-full w-full overflow-hidden bg-transparent"
    onclick={hideContextMenu}
    oncontextmenu={handleOnContextMenu}
    onkeypress={() => {}}
  >
    <div
      role="menu"
      tabindex="-1"
      bind:this={contextMenuEl}
      class="bg-popover text-popover-foreground absolute z-50 min-w-40 overflow-x-hidden overflow-y-auto rounded-md border shadow-md"
      style:left="{clampedX}px"
      style:top="{clampedY}px"
    >
      <ContextMenuComponent {...props} />
    </div>
  </div>
{/if}
