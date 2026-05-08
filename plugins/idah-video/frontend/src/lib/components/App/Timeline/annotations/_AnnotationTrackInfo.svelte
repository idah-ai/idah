<script lang="ts">
  import ToolTooltip from "$lib/components/ui/Tooltips/ToolTooltip.svelte";
  import Button from "$lib/components/ui/Button/Button.svelte";
  import TrackInfoContextMenu from "$lib/components/App/Timeline/annotations/_TrackInfoContextMenu.svelte";

  import {
    showContextMenu,
    type ContextMenuComponent,
    type ContextMenuComponentProps,
  } from "$lib/components/App/ContextMenu/store";
  import { selection } from "$lib/state/selection.svelte";
  import { getGroupContextMenus } from "$lib/components/App/Timeline/annotations/menus";
  import { TRACK_HEIGHT } from "$lib/components/App/Timeline/constants";
  import { cn } from "$lib/utils";

  import type { IVideoAnnotationRecord } from "$idah/v2/video-types";
  import type { TrackData } from "$lib/components/App/Timeline/types";

  // Props
  interface Props {
    track: TrackData;
    onClick: (annotation?: IVideoAnnotationRecord) => void;
  }
  let { track, onClick }: Props = $props();

  // Variables
  let { id, title, subtitle, top, items } = $derived(track);
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
    selectAnnotationGroup();
    /**
     * Select annotation group
     * 1. If there is no selectedCurrentFrame, select the first frame of the annotation group
     * 2. If there is selectedCurrentFrame, select the closest annotation to the selectedCurrentFrame
     */
    onClick(items[0].rawData);
  }
</script>

<button
  class={cn(
    "hover:bg-secondary absolute right-0 left-0 box-border cursor-pointer border-b px-2 text-left select-none focus:outline-none",
    {
      "border-primary bg-primary/10 border-t border-b": isGroupSelected,
    },
  )}
  style:top="{top}px;"
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
