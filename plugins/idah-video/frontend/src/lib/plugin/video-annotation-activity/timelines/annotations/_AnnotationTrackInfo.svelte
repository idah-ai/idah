<script lang="ts">
  import { getContext } from "svelte";

  import ToolTooltip from "$lib/components/app/tooltips/tool-tooltip.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import TrackInfoContextMenu from "$lib/plugin/video-annotation-activity/timelines/annotations/_TrackInfoContextMenu.svelte";

  import {
    showContextMenu,
    type ContextMenuComponent,
    type ContextMenuComponentProps,
  } from "$lib/plugin/video-annotation-activity/context-menu/context-menu.store";
  import { selectedAnnotationGroup } from "$lib/plugin/video-annotation-activity/store/store";
  import { getGroupContextMenus } from "$lib/plugin/video-annotation-activity/timelines/annotations/menus";
  import { TRACK_HEIGHT } from "$lib/plugin/video-annotation-activity/timelines/constants";
  import { cn } from "$lib/utils";

  import type { IActivityContext } from "$idah/context/activity-context";
  import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";
  import type { TrackData } from "$lib/plugin/video-annotation-activity/timelines/types";

  // Props
  interface Props {
    track: TrackData;
    onClick: (annotation?: VideoAnnotationObject) => void;
  }
  let { track, onClick }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let { id, title, subtitle, top, items } = $derived(track);
  let isGroupSelected = $derived($selectedAnnotationGroup?.groupId === id);
  const menus = $derived(getGroupContextMenus({ context, track }));

  // Functions
  function selectAnnotationGroup() {
    $selectedAnnotationGroup = {
      groupId: id,
      annotations: items.map((item) => item.rawData),
    };
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
