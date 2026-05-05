<script lang="ts" module>
  import { type Icon as IconType } from "@lucide/svelte";

  export interface TimelineContextMenuMenu {
    label: string;
    icon?: typeof IconType;
    disabled?: boolean;
    onClick: () => void;
  }

  export interface TimelineContextMenuMenus {
    [group: string]: {
      label?: string;
      items: Array<TimelineContextMenuMenu>;
    };
  }

  export interface ITimelineContextMenu {
    visible: boolean;
    x: number;
    y: number;
    menus: TimelineContextMenuMenus;
  }
</script>

<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import Separator from "$lib/components/ui/separator/separator.svelte";

  // Props
  interface Props {
    contextMenu: ITimelineContextMenu;
    onCloseContextMenu: () => void;
  }
  let { contextMenu, onCloseContextMenu }: Props = $props();

  // Variables
  let { visible, x: positionX, y: positionY, menus } = $derived(contextMenu);
  let contextMenuWidth = $state<number>(0);
  let contextMenuHeight = $state<number>(0);
  let canShowLeft = $derived(positionX + contextMenuWidth <= window.innerWidth);
  let canShowBottom = $derived(positionY + contextMenuHeight <= window.innerHeight);

  // Functions
  function onClickOutSide(node: HTMLElement, callback: () => void) {
    function handleClick(event: MouseEvent) {
      if (!node.contains(event.target as Node)) {
        callback();
      }
    }

    document.addEventListener("click", handleClick, true);

    return {
      destroy() {
        document.removeEventListener("click", handleClick, true);
      },
    };
  }
</script>

{#if visible}
  <div
    bind:clientWidth={contextMenuWidth}
    bind:clientHeight={contextMenuHeight}
    use:onClickOutSide={onCloseContextMenu}
    class="bg-background absolute z-50 min-w-40 rounded-lg border"
    style:left="{canShowLeft ? positionX : positionX - contextMenuWidth}px"
    style:top="{canShowBottom ? positionY : positionY - contextMenuHeight}px"
  >
    <div class="my-1 flex flex-col">
      {#each Object.entries(menus) as [groupKey, group], groupIndex (groupKey)}
        {@const isLastGroup = Object.keys(menus).length - 1 === groupIndex}
        <!-- GROUP LABEL (IF NEEDED TO SHOW) -->
        <!-- {#if group.label}
          <Text>{group.label}</Text>
        {/if} -->

        {#each group.items as item (item.label)}
          <Button variant="ghost" size="sm" class="mx-1 justify-start" onclick={item.onClick}>
            <item.icon />
            {item.label}
          </Button>
        {/each}

        <!-- Only show separator if group has items and it is not the last group -->
        {#if !isLastGroup && group.items.length > 0}
          <Separator class="my-1" />
        {/if}
      {/each}
    </div>
  </div>
{/if}
