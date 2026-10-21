<script lang="ts">
  import { CircleAlertIcon } from "@lucide/svelte";

  import AnnotationLabelNotFound from "$lib/components/App/Error/AnnotationLabelNotFound.svelte";
  import * as HoverCard from "$lib/components/ui/HoverCard/index";
  import KbdTooltipButton from "$lib/components/ui/Tooltips/KbdTooltipButton.svelte";
  import ShapeIcon from "$lib/components/App/SelectionPanel/_ShapeIcon.svelte";
  import Tooltips from "$lib/components/ui/Tooltips/Tooltips.svelte";
  import TrackInfoContextMenu from "$lib/components/App/Timeline/annotations/_TrackInfoContextMenu.svelte";

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
  import { annotation } from "$lib/state/annotation.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { sidebarTabs } from "$lib/state/sidebar-tabs.svelte";

  import type { TrackData } from "$lib/components/App/Timeline/types";

  // Props
  interface Props {
    track: TrackData;
  }
  let { track }: Props = $props();

  // Variables
  const { id, title, subtitle, items } = $derived(track);
  const firstAnnotation = $derived(items[0].rawData);
  const shapeType = $derived(firstAnnotation.shape_type ?? "");
  const config = $derived(getDriver().config[shapeType]);
  const category = $derived(config.values.find((v) => v.id === firstAnnotation.category));
  const foundCategory = $derived(category !== undefined);
  const color = $derived.by(() => {
    const ann = firstAnnotation;
    return ann ? resolveAnnotationColor(ann) : "gray";
  });
  const isGroupSelected = $derived(selection.isGroupSelected(id));
  const isGroupHidden = $derived(annotation.isHidden(id));
  const isGroupLocked = $derived(annotation.isLocked(id));
  const showTooltip = $derived(isGroupHidden || title.length > 17);
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

{#snippet AnnotationTrackInfo()}
  <button
    class={cn(
      "hover:bg-secondary box-border block w-full cursor-pointer border-b text-left select-none focus:outline-none",
      {
        "border-primary/50 bg-primary/10 border-t border-b": isGroupSelected && foundCategory,
        "border-destructive/50 bg-destructive/5 hover:bg-destructive/10 border-t border-b": !foundCategory,
        "border-destructive bg-destructive/20 hover:bg-destructive/20 border-t border-b":
          isGroupSelected && !foundCategory,
      },
    )}
    style:height="{TRACK_HEIGHT}px;"
    oncontextmenu={handleOnContextMenu}
    onclick={handleClick}
  >
    <div class="group relative flex items-center gap-2 px-2">
      {#if foundCategory}
        <ShapeIcon {shapeType} {color} />
      {:else}
        <CircleAlertIcon class="fill-destructive text-primary-foreground size-5 shrink-0" />
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
              "text-primary font-bold": isGroupSelected && foundCategory,
              "text-destructive font-bold": isGroupSelected && !foundCategory,
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
{/snippet}

{#if foundCategory}
  {@render AnnotationTrackInfo()}
{:else}
  <HoverCard.Root>
    <HoverCard.Trigger>
      {@render AnnotationTrackInfo()}
    </HoverCard.Trigger>

    <HoverCard.Content side="right">
      <AnnotationLabelNotFound
        displayName={title}
        content="This annotation label was renamed or deleted from the label configuration. Reassign this annotation to a valid label."
      />
    </HoverCard.Content>
  </HoverCard.Root>
{/if}
