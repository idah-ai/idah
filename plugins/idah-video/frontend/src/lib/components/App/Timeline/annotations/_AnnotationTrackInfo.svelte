<script lang="ts">
  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";

  import TrackInfoContextMenu from "$lib/components/App/Timeline/annotations/_TrackInfoContextMenu.svelte";
  import Button from "$lib/components/ui/Button/Button.svelte";
  import Tooltips from "$lib/components/ui/Tooltips/Tooltips.svelte";
  import ToolTooltip from "$lib/components/ui/Tooltips/ToolTooltip.svelte";
  import Icon from "$lib/components/ui/Icon/Icon.svelte";

  import {
    showContextMenu,
    type ContextMenuComponent,
    type ContextMenuComponentProps,
  } from "$lib/components/App/ContextMenu/store";
  import { getGroupContextMenus } from "$lib/components/App/Timeline/annotations/menus";
  import { TRACK_HEIGHT } from "$lib/components/App/Timeline/constants";
  import { selection } from "$lib/state/selection.svelte";
  import { cn } from "$lib/utils";
  import { resolveAnnotationColor } from "$lib/utils/color";
  import { VIDEO_BOUNDING_BOX, VIDEO_POLYGON } from "$lib/types";
  import { annotation } from "$lib/state/annotation.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  import type { TrackData } from "$lib/components/App/Timeline/types";

  // Props
  interface Props {
    track: TrackData;
  }
  let { track }: Props = $props();

  // Variables
  let { id, title, subtitle, items } = $derived(track);
  let shapeType = $derived(items[0]?.rawData.shape?.type ?? "");
  let color = $derived.by(() => {
    const ann = items[0]?.rawData;
    return ann ? resolveAnnotationColor(ann) : "gray";
  });
  let isGroupSelected = $derived.by(() => {
    const v = selection.value;
    return v?.type === "group" && v.groupId === id;
  });
  let isGroupHidden = $derived(annotation.isHidden(id));
  let isGroupLocked = $derived(annotation.isLocked(id));
  let showTooltip = $derived(isGroupHidden || title.length > 17);
  const menus = $derived(getGroupContextMenus({ track }));

  // Functions
  function selectAnnotationGroup() {
    selection.selectGroup(id);
  }

  function handleOnContextMenu(e: MouseEvent) {
    e.preventDefault();

    if (viewport.isReviewWorkspace) return;

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
    "hover:bg-secondary box-border block w-full cursor-pointer border-b text-left select-none focus:outline-none",
    {
      "border-primary/50 bg-primary/10 border-t border-b": isGroupSelected,
    },
  )}
  style:height="{TRACK_HEIGHT}px;"
  oncontextmenu={handleOnContextMenu}
  onclick={handleClick}
>
  <div class="group relative flex items-center gap-2 px-2">
    {#if shapeType === VIDEO_BOUNDING_BOX}
      <Icon src={vectorSquareIconSvg} {color} />
    {:else if shapeType === VIDEO_POLYGON}
      <Icon src={polygonIconSvg} {color} />
    {/if}

    <div class="flex min-w-0 flex-col">
      <!-- SUBTITLE::CATEGORY -->
      <span id="subtitle" class="text-muted-foreground truncate text-xs">
        {subtitle}
      </span>

      <!-- TITLE::CATEGORY WITH GROUP ID -->
      {#if showTooltip}
        <Tooltips
          class={cn("font-regular min-w-64 truncate text-left text-xs group-hover:min-w-32", {
            "text-primary font-bold": isGroupSelected,
            "min-w-44": isGroupLocked,
            "min-w-32": isGroupHidden,
          })}
        >
          {#snippet trigger()}
            {title}
          {/snippet}

          {#snippet content()}
            {title}
          {/snippet}
        </Tooltips>
      {:else}
        <span
          class={cn("font-regular min-w-64 truncate text-xs group-hover:min-w-32", {
            "text-primary font-bold": isGroupSelected,
            "min-w-44": isGroupLocked,
            "min-w-32": isGroupHidden,
          })}
        >
          {title}
        </span>
      {/if}
    </div>

    {#if !viewport.isReviewWorkspace}
      <div class="ml-auto flex shrink-0 items-center">
        {#each Object.entries(menus.actions.items) as [key, { label, icon: Icon, disabled, alwaysShow, onClick }] (key)}
          <div class={cn("", alwaysShow ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
            <ToolTooltip {label}>
              {#snippet trigger()}
                <Button variant="ghost" size="icon-sm" class="focus:outline-none" {disabled} onclick={onClick}>
                  <Icon />
                </Button>
              {/snippet}
            </ToolTooltip>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</button>
