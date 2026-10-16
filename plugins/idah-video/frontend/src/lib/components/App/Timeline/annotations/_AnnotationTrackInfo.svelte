<script lang="ts">
  import polygonIconSvg from "$lib/assets/icons/polygon.svg?raw";
  import vectorSquareIconSvg from "$lib/assets/icons/vector-square.svg?raw";

  import TrackInfoContextMenu from "$lib/components/App/Timeline/annotations/_TrackInfoContextMenu.svelte";
  import Icon from "$lib/components/ui/Icon/Icon.svelte";
  import KbdTooltipButton from "$lib/components/ui/Tooltips/KbdTooltipButton.svelte";
  import Tooltips from "$lib/components/ui/Tooltips/Tooltips.svelte";

  import {
    showContextMenu,
    type ContextMenuComponent,
    type ContextMenuComponentProps,
  } from "$lib/components/App/ContextMenu/store";
  import { getGroupContextMenus } from "$lib/components/App/Timeline/annotations/menus";
  import { TRACK_HEIGHT } from "$lib/components/App/Timeline/constants";
  import { annotation } from "$lib/state/annotation.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { sidebarTabs } from "$lib/state/sidebar-tabs.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { VIDEO_BOUNDING_BOX, VIDEO_POLYGON } from "$lib/types";
  import { cn } from "$lib/utils";
  import { resolveAnnotationColor } from "$lib/utils/color";

  import type { TrackData } from "$lib/components/App/Timeline/types";

  // Props
  interface Props {
    track: TrackData;
  }
  let { track }: Props = $props();

  // Variables
  let { id, title, subtitle, items } = $derived(track);
  let shapeType = $derived(items[0]?.rawData.shape_type ?? "");
  let color = $derived.by(() => {
    const ann = items[0]?.rawData;
    return ann ? resolveAnnotationColor(ann) : "gray";
  });
  let isGroupSelected = $derived(selection.isGroupSelected(id));
  let isGroupHidden = $derived(items.length > 0 && items.every((item) => annotation.isHidden(item.rawData)));
  let isVisibleAtFrame = $derived(
    items.some(
      (item) =>
        item.startRange <= viewport.video.currentFrame.value &&
        item.endRange >= viewport.video.currentFrame.value &&
        !annotation.isHidden(item.rawData),
    ),
  );
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

    // If this group is not already selected, select it (replacing current selection).
    // If it IS already selected, preserve the multi-selection.
    if (!selection.isGroupSelected(id)) {
      sidebarTabs.rightTab = "annotations";
      selectAnnotationGroup();
    }

    const contextMenuProps: ContextMenuComponentProps = {
      track,
    };

    showContextMenu(TrackInfoContextMenu as ContextMenuComponent, contextMenuProps, e.clientX, e.clientY);
  }

  function handleClick(e: MouseEvent) {
    /**
     * Select annotation group — Shift+Click toggles the group in/out
     * of the timeline group selection (same modifier as viewport multi-select).
     * Plain click replaces the selection with this single group (existing behaviour).
     */
    // Clicking an annotation row while on the Tagging tab should surface the
    // Annotations tab so the selected annotation is visible/editable there.
    sidebarTabs.rightTab = "annotations";
    if (e.shiftKey) {
      selection.toggleGroup(id);
    } else {
      selectAnnotationGroup();
    }
  }
</script>

<button
  class={cn(
    "hover:bg-secondary relative box-border block w-full cursor-pointer border-b text-left select-none focus:outline-none",
    {
      "hover:bg-primary/5 before:bg-primary bg-clip-padding before:pointer-events-none before:absolute before:inset-y-1.5 before:left-px before:w-1 before:rounded-full before:content-['']":
        isVisibleAtFrame,
      "border-primary bg-primary/15 hover:bg-primary/20 border-t border-b bg-clip-padding": isGroupSelected,
    },
  )}
  style:height="{TRACK_HEIGHT}px;"
  oncontextmenu={handleOnContextMenu}
  onclick={handleClick}
>
  <div class="group relative flex items-center gap-2 px-2">
    {#if shapeType === VIDEO_BOUNDING_BOX}
      <Icon src={vectorSquareIconSvg} {color} class={isGroupHidden ? "opacity-50" : ""} />
    {:else if shapeType === VIDEO_POLYGON}
      <Icon src={polygonIconSvg} {color} class={isGroupHidden ? "opacity-50" : ""} />
    {/if}

    <div class="flex min-w-0 flex-col" class:opacity-50={isGroupHidden}>
      <!-- SUBTITLE::CATEGORY -->
      <span id="subtitle" class="text-muted-foreground truncate text-xs">
        {subtitle}
      </span>

      <!-- TITLE::CATEGORY WITH GROUP ID -->
      {#if showTooltip}
        <Tooltips
          class={cn("font-regular min-w-64 truncate text-left text-xs group-hover:min-w-32", {
            "text-primary font-bold": isGroupSelected && !isGroupHidden,
            "font-semibold": isVisibleAtFrame && !isGroupSelected,
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
            "text-primary font-bold": isGroupSelected && !isGroupHidden,
            "font-semibold": isVisibleAtFrame && !isGroupSelected,
            "min-w-44": isGroupLocked,
            "min-w-32": isGroupHidden,
          })}
        >
          {title}
        </span>
      {/if}
    </div>

    {#if id !== "__entry_notes__"}
      <div class="ml-auto flex shrink-0 items-center">
        {#each Object.entries(menus.actions.items) as [key, { label, icon, disabled, alwaysShow, onClick }] (key)}
          <div class={cn("", alwaysShow ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
            <KbdTooltipButton
              {label}
              {icon}
              variant="ghost"
              size="icon-sm"
              class="focus:outline-none"
              {disabled}
              onclick={onClick}
            />
          </div>
        {/each}
      </div>
    {/if}
  </div>
</button>
