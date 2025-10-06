<script lang="ts">
  import { getContext } from "svelte";

  import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";

  import { cn } from "@/utils";
  import { ArrowLeftRightIcon, Trash2Icon } from "@lucide/svelte";

  import type { VideoAnnotation } from "../VideoAnnotationContext";
  import type { LabelingConfiguration } from "@/data/model/dataset/labels";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    annotation,
    frame,
    currentFrame,
    range,
    scale,
    inSpan,
    keyframes,
    hovered,
    onSeekFrame,
    onSelectAnnotation,
    onDeleteFrame,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & {
    annotation: VideoAnnotation;
    frame: number;
    currentFrame: number;
    range: [number, number];
    scale: number;
    inSpan: boolean;
    keyframes: number[];
    hovered: boolean;
    onSeekFrame: (frame: number) => void;
    onSelectAnnotation: (annotation: VideoAnnotation) => void;
    onDeleteFrame: (frame: number) => void;
  } = $props();

  // Contexts
  const labelConfig: LabelingConfiguration = getContext("labelConfig");

  // Variables
  let categoryColor: string | undefined = $derived(getCategory(annotation.value.category)?.color);
  let cellWidth: number = $derived(
    (1 / ((range[1] - range[0] + (scale - ((range[1] - range[0]) % scale))) / 100)) * scale,
  );
  let isSelected: boolean = $derived(Math.floor(currentFrame / scale) == Math.floor(frame / scale));
  let isHovered: boolean = $derived(hovered && !isSelected);

  // Functions
  function getCategory(categoryId: string | undefined) {
    if (!categoryId) return undefined;

    return labelConfig.categories.find((cat) => cat.id === categoryId);
  }
</script>

<div
  class={cn("inline-block h-full border-b py-1 first:border-l", {
    "bg-primary/20": isSelected,
    "bg-primary/10": isHovered,
  })}
  style:box-sizing="border-box"
  style:width="{cellWidth}%"
  onclick={() => {
    onSeekFrame(frame);
    onSelectAnnotation(annotation);
  }}
  {...restProps}
>
  {#if inSpan}
    <div
      class={cn("relative h-full", {
        "bg-primary/5": isHovered || isSelected,
      })}
      style:background-color={categoryColor ? categoryColor + "30" : "#FEF9C2"}
    >
      {#if keyframes.length}
        <ContextMenu>
          <ContextMenuTrigger class="absolute top-[3px] h-full w-full pt-0">
            <div
              class="m-auto h-3/4 w-3/4 cursor-context-menu rounded"
              style:background-color={categoryColor ? categoryColor : "#FF0000"}
            ></div>
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
