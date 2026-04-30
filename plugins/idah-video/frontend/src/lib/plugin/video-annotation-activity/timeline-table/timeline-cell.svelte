<script lang="ts">
  import { ArrowLeftRightIcon, SquareSplitHorizontalIcon, Trash2Icon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuGroup,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
  } from "$lib/components/ui/context-menu";

  import { selectedAnnotation } from "$lib/plugin/video-annotation-activity/store/store";
  import { cn } from "$lib/utils";

  import type { IActivityContext } from "$idah/context/activity-context";
  import type { AnnotationGroup } from "$idah/context/annotation-context";
  import type { Hash } from "$idah/utils/types";
  import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

  // Props
  interface Props {
    group: AnnotationGroup<VideoAnnotationObject>;
    annotations: VideoAnnotationObject[];
    currentFrameInCell: number;
    range: [number, number];
    scale: number;
    totalFrames: number;
    zoom: number;
    hoveredAnnotation: VideoAnnotationObject | undefined;
    onSeekFrame: (frame: number) => void;
    onDeleteFrame: (annotation: VideoAnnotationObject, frame: number) => void;
    onSelectAnnotation: (annotation?: VideoAnnotationObject) => void;
    onHoverAnnotation: (annotation: VideoAnnotationObject | undefined) => void;
    onHoverCell: (frame?: number) => void;
    onSelectGroupAtFrame: (annotationGrop: AnnotationGroup<VideoAnnotationObject>, frame: number) => void;
  }
  let {
    group,
    annotations,
    currentFrameInCell,
    range,
    scale,
    totalFrames,
    zoom,
    hoveredAnnotation,
    onSeekFrame,
    onDeleteFrame,
    onSelectAnnotation,
    onHoverAnnotation,
    onHoverCell,
    onSelectGroupAtFrame,
  }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let rangeSpan: number = $derived(Math.min(scale * zoom, totalFrames));
  let cellWidth: number = $derived((1 / ((range[1] - range[0] + (scale - (rangeSpan % scale))) / 100)) * scale);

  /** IN THIS CELL */
  let annotation: VideoAnnotationObject | undefined = $derived(
    annotations.find(
      (annotation) => currentFrameInCell >= annotation.shape.start && currentFrameInCell <= annotation.shape.end,
    ),
  );
  let category = $derived(annotation ? getCategory(annotation.value.category) : undefined);
  let categoryColor = $derived(category?.color);
  let keyFrames = $derived(
    (annotation?.shape.frames || []).filter(
      (frame: Hash) => frame.frame >= currentFrameInCell && frame.frame <= currentFrameInCell,
    ),
  );
  let isStartOfKeyFrameRange = $derived(annotation?.shape.start === currentFrameInCell);
  let isEndOfKeyFrameRange = $derived(annotation?.shape.end === currentFrameInCell);
  let annotationIsSelected: boolean = $derived($selectedAnnotation?.metadata.id == annotation?.metadata.id);
  let annotationIsHovered: boolean = $derived(hoveredAnnotation?.metadata.id == annotation?.metadata.id);
  let annotationIsSelectedOrHovered: boolean = $derived(annotationIsSelected || annotationIsHovered);

  // Functions
  function getCategory(categoryId: string | undefined) {
    return Object.entries(context.config)
      .find(([shapeKey, _value]) => shapeKey == annotation?.shape.type)?.[1]
      .values.find((category) => category.id === categoryId);
  }

  function deleteFrame(frame: number) {
    if (!annotation) return;
    onDeleteFrame(annotation, frame);
  }

  function selectFrame() {
    onSeekFrame(currentFrameInCell);

    if (annotation) {
      onSelectAnnotation(annotation);
    } else {
      onSelectGroupAtFrame(group, currentFrameInCell);
    }
  }

  function onMouseOver() {
    onHoverAnnotation(annotation);
    onHoverCell(currentFrameInCell);
  }

  function onMouseEnter() {
    onHoverAnnotation(annotation);
    onHoverCell(currentFrameInCell);
  }

  function onMouseLeave() {
    onHoverAnnotation(undefined);
    onHoverCell(undefined);
  }
</script>

<div
  id="{group.groupId}__{currentFrameInCell}"
  class={cn("inline-block h-full border-b py-1 first:border-l", {
    "cursor-pointer": annotationIsSelectedOrHovered,
  })}
  role="button"
  tabindex={annotationIsSelectedOrHovered ? 0 : -1}
  style:box-sizing="border-box"
  style:width="{cellWidth}%"
  onclick={selectFrame}
  onfocus={selectFrame}
  onkeypress={selectFrame}
  onmouseover={onMouseOver}
  onmouseenter={onMouseEnter}
  onmouseleave={onMouseLeave}
>
  <div
    class={cn("relative z-20 h-full", {
      "bg-primary/5": annotationIsSelectedOrHovered,
      "border-t border-b": !!categoryColor,
      "rounded-tl-sm rounded-bl-sm border-l": isStartOfKeyFrameRange && !!categoryColor,
      "rounded-tr-sm rounded-br-sm border-r": isEndOfKeyFrameRange && !!categoryColor,
    })}
    style:background-color={categoryColor
      ? `${categoryColor}${annotationIsSelectedOrHovered ? "60" : "30"}`
      : "transparent"}
    style:border-color={categoryColor}
  >
    <!-- Only render context menu if the cell have annotation, this will prevent over-render in empty timeline cell -->
    {#if annotation}
      <ContextMenu>
        <ContextMenuTrigger class="absolute top-[3px] h-full w-full pt-0">
          <!-- If have keyframes, render a box -->
          {#if keyFrames.length}
            <div
              class="m-auto h-3/4 w-3/4 rounded"
              style:background-color={categoryColor ? categoryColor : "transparent"}
            ></div>
          {/if}
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuGroup>
            <!-- SPLIT ANNOTATION -->
            <ContextMenuItem
              onclick={() =>
                context.commands.run("annotation.split", {
                  id: annotation?.metadata.id,
                  at: currentFrameInCell,
                })}
              disabled={annotation?.locked}
            >
              <SquareSplitHorizontalIcon class="size-4" />
              Split at frame {currentFrameInCell}
            </ContextMenuItem>
          </ContextMenuGroup>

          <ContextMenuGroup>
            {#each keyFrames as { frame }, index (index)}
              <ContextMenuItem onclick={() => onSeekFrame?.(frame)}>
                <ArrowLeftRightIcon class="size-4" />
                Seek frame {frame}
              </ContextMenuItem>

              {#if ["review", "annotate"].includes(context.workflowStep)}
                <ContextMenuItem onclick={() => deleteFrame(frame)} disabled={annotation?.locked}>
                  <Trash2Icon class="size-4" />
                  Delete frame {frame}
                </ContextMenuItem>
                <ContextMenuItem onclick={() => {}} disabled={annotation?.locked}>
                  <Trash2Icon class="size-4" />
                  Copy frame {frame}
                </ContextMenuItem>
              {/if}
            {/each}
          </ContextMenuGroup>

          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem
              onclick={() => context.commands.run("annotation.delete", { annotationId: annotation?.metadata.id })}
            >
              <Trash2Icon class="size-4" />
              Delete annotation
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    {/if}
  </div>
</div>
