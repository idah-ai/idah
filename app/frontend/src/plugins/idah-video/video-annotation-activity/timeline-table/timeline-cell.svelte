<script lang="ts">
  import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";

  import { cn } from "@/utils";
  import { ArrowLeftRightIcon, Trash2Icon } from "@lucide/svelte";
  import { getContext } from "svelte";

  let {
    frame,
    currentFrame,
    range,
    scale,
    inSpan,
    keyframes,
    hovered,
    onSeekFrame,
    onDeleteFrame,
    ...restProps
  }: {
    frame: number;
    currentFrame: number;
    range: [number, number];
    scale: number;
    inSpan: boolean;
    keyframes: number[];
    hovered: boolean;
    onSeekFrame: (frame: number) => void;
    onDeleteFrame: (frame: number) => void;
  } = $props();

  // Contexts
  const labelConfig = getContext("labelConfig");

  // Variables
  let cellWidth: number = $derived(
    (1 / ((range[1] - range[0] + (scale - ((range[1] - range[0]) % scale))) / 100)) * scale,
  );
  let isSelected: boolean = $derived(Math.floor(currentFrame / scale) == Math.floor(frame / scale));
  let isHovered: boolean = $derived(hovered && !isSelected);
</script>

<div
  class={cn("inline-block h-full", {
    "bg-primary/10": isSelected,
    "bg-primary/20": isHovered,
  })}
  style:box-sizing="border-box"
  style:width="{cellWidth}%"
  onclick={() => onSeekFrame(frame)}
  {...restProps}
>
  {#if inSpan}
    <div class="relative" style:background-color="#fef9c2" style:height="80%" style:margin-top="8%">
      {#if keyframes.length}
        <ContextMenu>
          <ContextMenuTrigger class="absolute top-2.5 h-full w-full pt-0">
            <div style="margin:auto" style:background-color="#06B6D4" style:height="25%" style:width="50%"></div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {#each keyframes as keyframe, index (index)}
              <ContextMenuItem onclick={() => onSeekFrame?.(keyframe)}>
                <ArrowLeftRightIcon class="size-4"></ArrowLeftRightIcon>
                Seek frame {keyframe}
              </ContextMenuItem>

              <ContextMenuItem onclick={() => onDeleteFrame?.(keyframe)}>
                <Trash2Icon class="size-4"></Trash2Icon>
                Delete frame
              </ContextMenuItem>
            {/each}
          </ContextMenuContent>
        </ContextMenu>
      {/if}
    </div>
  {/if}
</div>
