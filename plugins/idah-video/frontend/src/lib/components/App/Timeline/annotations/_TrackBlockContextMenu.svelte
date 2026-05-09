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

  // Props
  interface Props extends ContextMenuComponentProps {
    item: TimelineItem;
    currentFrame?: number;
  }
  let { item, currentFrame }: Props = $props();

  // Variables
  let { trackId, startRange, endRange, rawData: annotation } = $derived(item);
  let frame = $derived(currentFrame ?? viewport.video.currentFrame.value);
  let isKeyframe = $derived(annotation.shape.frames.some((f) => f.frame === frame));
  let isStartOrEnd = $derived(frame === annotation.shape.start || frame === annotation.shape.end);

  // Focus: adjust viewport to show only this annotation's range, then seek if needed
  function focusOnAnnotation() {
    const duration = annotation.shape.end - annotation.shape.start;
    const margin = Math.max(10, Math.round(duration * 0.1));
    viewport.timeline.range = {
      startRange: annotation.shape.start - margin,
      endRange: annotation.shape.end + margin,
    };
  }

  let menus = $derived<Menus>({
    actions: {
      items: {
        focus: {
          label: "Focus",
          icon: CrosshairIcon,
          onClick: focusOnAnnotation,
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
                destructive: true,
                onClick: () => {
                  getDriver().command.call("annotation.deleteKeyframe", {
                    id: annotation.id,
                    frame,
                  });
                },
              },
            }
          : {
              addKeyframe: {
                label: `Add keyframe`,
                icon: FramerIcon,
                onClick: () => {
                  getDriver().command.call("annotation.addKeyframe", {
                    id: annotation.id,
                    frame,
                  });
                },
              },
            }),
        ...(!isStartOrEnd
          ? {
              split: {
                label: `Split at frame ${frame}`,
                icon: SquareSplitHorizontalIcon,
                onClick: () => {
                  getDriver().command.call("annotation.split", {
                    id: annotation.id,
                    at: frame,
                  });
                },
              },
            }
          : {}),
      },
    },
    danger: {
      items: {
        delete: {
          label: `Delete annotation`,
          icon: Trash2Icon,
          destructive: true,
          onClick: () => {
            getDriver().command.call("annotation.delete", {
              id: annotation.id,
            });
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
        <Button
          variant={destructive ? "destructive-ghost" : "ghost"}
          size="sm"
          class="mx-1 justify-start"
          {disabled}
          onclick={onClick}
        >
          <Icon />
          {label}
        </Button>
      {/if}
    {/each}

    {#if !isLastGroup && Object.keys(group.items).length > 0}
      <Separator class="my-1" />
    {/if}
  {/each}
</div>
