<script lang="ts">
  import {
    CrosshairIcon,
    SquareSplitHorizontalIcon,
    Trash2Icon,
    FramerIcon,
    type Icon as IconType,
  } from "@lucide/svelte";

  import Button from "$lib/components/ui/Button/Button.svelte";
  import Separator from "$lib/components/ui/Separator/Separator.svelte";

  import type { ContextMenuComponentProps } from "$lib/components/App/ContextMenu/store";
  import type { Menus } from "$lib/components/App/ContextMenu/types";
  import type { TimelineItem } from "$lib/components/App/Timeline/types";

  import { viewport } from "$lib/state/viewport.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { annotation } from "$lib/state/annotation.svelte";
  import { isEditable } from "$lib/state/editor.svelte";

  // Props
  interface Props extends ContextMenuComponentProps {
    item: TimelineItem;
    currentFrame?: number;
  }
  let { item, currentFrame }: Props = $props();

  // Variables
  let { trackId, startRange, endRange, rawData } = $derived(item);
  let frame = $derived(currentFrame ?? viewport.video.currentFrame.value);
  let isKeyframe = $derived(rawData.shape.frames.some((f: {frame: number, x?: number, y?: number}) => f.frame === frame));
  let annotationIsLocked = $derived(annotation.isLocked(rawData));

  let menus = $derived<Menus>({
    actions: {
      items: {
        focus: {
          label: "Focus",
          icon: CrosshairIcon,
          onClick: () => {
            /** Select an annotation before focus it */
            selection.selectAnnotation(rawData);
            getDriver().command.call("timeline.focus");
          },
        },
      },
    },
    edit: {
      items: {
        ...(isKeyframe
          ? {
              deleteKeyframe: {
                label: `Delete keyframe`,
                icon: Trash2Icon,
                disabled: annotationIsLocked || !isEditable(),
                destructive: true,
                onClick: () => {
                  getDriver().command.call("annotation.keyframe_delete", {
                    annotationId: rawData.id,
                    frame,
                  });
                },
              },
            }
          : {
              addKeyframe: {
                label: `Add keyframe`,
                icon: FramerIcon,
                disabled: annotationIsLocked || !isEditable(),
                onClick: () => {
                  getDriver().command.call("annotation.keyframe_add", {
                    annotationId: rawData.id,
                    selection: {
                      frame,
                      angle: 0,
                      points: [],
                    },
                  });
                },
              },
            }),
        split: {
          label: `Split at frame ${frame + 1}`,
          icon: SquareSplitHorizontalIcon,
          disabled: annotationIsLocked || !isEditable(),
          onClick: () => {
            getDriver().command.call("annotation.split", {
              annotationId: rawData.id,
              at: frame,
            });
          },
        },
      },
    },
    danger: {
      items: {
        delete: {
          label: `Delete annotation`,
          icon: Trash2Icon,
          disabled: annotationIsLocked || !isEditable(),
          destructive: true,
          onClick: () => {
            selection.selectAnnotation(rawData);
            getDriver().command.call("selection.delete", {});
          },
        },
      },
    },
  });
</script>

<div class="bg-background my-1 flex flex-col">
  {#each Object.entries(menus) as [groupKey, group], groupIndex (groupKey)}
    {@const isLastGroup = Object.keys(menus).length - 1 === groupIndex}

    {#each Object.entries(group.items) as [menuKey, { label, icon: Icon, disabled, hidden, destructive, onClick }] (menuKey)}
      {#if !hidden}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          role="none"
          onclick={(e) => {
            if (disabled) e.stopPropagation();
          }}
        >
          <Button
            variant={destructive ? "destructive-ghost" : "ghost"}
            size="sm"
            class="mx-1 w-full justify-start"
            {disabled}
            onclick={onClick}
          >
            <Icon />
            {label}
          </Button>
        </div>
      {/if}
    {/each}

    {#if !isLastGroup && Object.keys(group.items).length > 0}
      <Separator class="my-1" />
    {/if}
  {/each}
</div>
