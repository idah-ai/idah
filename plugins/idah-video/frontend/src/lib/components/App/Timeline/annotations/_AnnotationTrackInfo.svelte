<script lang="ts">
  import TrackInfoContextMenu from "$lib/components/App/Timeline/annotations/_TrackInfoContextMenu.svelte";
  import Button from "$lib/components/ui/Button/Button.svelte";
  import ToolTooltip from "$lib/components/ui/Tooltips/ToolTooltip.svelte";

  import {
    showContextMenu,
    type ContextMenuComponent,
    type ContextMenuComponentProps,
  } from "$lib/components/App/ContextMenu/store";
  import { getGroupContextMenus } from "$lib/components/App/Timeline/annotations/menus";
  import { TRACK_HEIGHT } from "$lib/components/App/Timeline/constants";
  import { selection } from "$lib/state/selection.svelte";
  import { cn } from "$lib/utils";

  import type { TrackData } from "$lib/components/App/Timeline/types";

  // Props
  interface Props {
    track: TrackData;
  }
  let { track }: Props = $props();

  // Variables
  let { id, title, subtitle, items } = $derived(track);
  let isGroupSelected = $derived.by(() => {
    const v = selection.value;
    return v?.type === "group" && v.groupId === id;
  });
  const menus = $derived(getGroupContextMenus({ track }));

  // Functions
  function selectAnnotationGroup() {
    selection.selectGroup(id);
  }

  function handleOnContextMenu(e: MouseEvent) {
    e.preventDefault();

    selectAnnotationGroup();

    const contextMenuProps: ContextMenuComponentProps = {
      track,
    };

    showContextMenu(TrackInfoContextMenu as ContextMenuComponent, contextMenuProps, e.clientX, e.clientY);
  }

  function handleClick() {
    /**
     * Select annotation group only — don't change the current drawing mode
     */
    selectAnnotationGroup();
  }
</script>

<button
  class={cn(
    "hover:bg-secondary box-border block w-full cursor-pointer border-b px-2 text-left select-none focus:outline-none",
    {
      "border-primary bg-primary/10 border-t border-b": isGroupSelected,
    },
  )}
  style:height="{TRACK_HEIGHT}px;"
  oncontextmenu={handleOnContextMenu}
  onclick={handleClick}
>
  <div class="group flex items-center">
    <div class="flex flex-col">
      <!-- SUBTITLE::CATEGORY -->
      <span id="subtitle" class="text-muted-foreground text-xs">
        {subtitle}
      </span>

      <!-- TITLE::CATEGORY WITH GROUP ID -->
      <span
        id="title"
        class={cn("font-regular truncate text-xs", {
          "text-primary font-bold": isGroupSelected,
        })}
      >
        {title}
      </span>
    </div>

    <div class="ml-auto flex shrink-0 items-center">
      {#each Object.entries(menus.actions.items) as [key, { label, icon: Icon, alwaysShow, onClick }] (key)}
        <div class={cn("", alwaysShow ? "block" : "hidden group-hover:flex")}>
          <ToolTooltip {label}>
            {#snippet trigger()}
              <Button variant="ghost" size="icon-sm" onclick={onClick}>
                <Icon />
              </Button>
            {/snippet}
          </ToolTooltip>
        </div>
      {/each}
    </div>
  </div>
</button>
