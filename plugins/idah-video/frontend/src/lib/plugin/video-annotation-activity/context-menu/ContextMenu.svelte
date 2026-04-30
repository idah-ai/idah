<script lang="ts">
  import {
    contextMenuState,
    hideContextMenu,
  } from "$lib/plugin/video-annotation-activity/context-menu/context-menu.store";

  // Variables
  let contextMenuWidth = $state<number>(0);
  let contextMenuHeight = $state<number>(0);

  let { visible, component, props, x, y } = $derived($contextMenuState);

  // Calculate if menu should be positioned to the left/bottom to stay in viewport
  const [offsetX, offsetY] = [16, 16];
  const realX = $derived(Math.min(x, window.innerWidth - contextMenuWidth - offsetX));
  const realY = $derived(Math.min(y, window.innerHeight - contextMenuHeight - offsetY));

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
</script>

<svelte:window onkeydown={handleKeydown} />

{#if visible && component}
  <div
    role="dialog"
    aria-modal="true"
    tabindex="0"
    class="absolute top-0 left-0 z-100 h-full w-full overflow-hidden bg-transparent"
    onclick={hideContextMenu}
    oncontextmenu={handleOnContextMenu}
    onkeypress={() => {}}
  >
    <div
      role="menu"
      tabindex="-1"
      bind:clientWidth={contextMenuWidth}
      bind:clientHeight={contextMenuHeight}
      class="bg-popover text-popover-foreground absolute z-50 min-w-40 overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md"
      style:left="{realX}px"
      style:top="{realY}px"
    >
      {@render component({ ...props })}
    </div>
  </div>
{/if}
