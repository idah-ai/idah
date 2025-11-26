<script lang="ts">
  import { getContext } from "svelte";

  import { Button } from "@/components/ui/button";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
  import Text from "@/components/ui/text/Text.svelte";
  import Timeline from "./timeline.svelte";

  import { cn } from "@/utils";
  import { humanize } from "@/utils/string";
  import { Trash2Icon } from "@lucide/svelte";
  import { boundingBoxes } from "../idb_store.svelte";

  import type { IActivityContext } from "@/plugin/interface/Activity";
  import type { AnnotationsIndexedDB } from "../indexedDB";
  import type {
    AnnotationMetadata,
    AnnotationObj,
    AnnotationShape,
    AnnotationValue,
  } from "@/context/AnnotationContext";

  // Props
  let {
    // tracking = false,
    scale,
    zoom,
    currentFrame,
    totalFrames,
    selectedAnnotation,
    annotations_promise,
    onSeekFrame,
    onDeleteAnnotation,
    onSelectAnnotation,
    onZoomChange,
    onScaleChange,
    db,
    isPlaying = false,
  }: {
    annotations_promise: Promise<AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>[]>;
    // tracking?: boolean;
    scale: number;
    zoom: number;
    currentFrame: number;
    totalFrames: number;
    selectedAnnotation?: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>;
    onSeekFrame: (frame: number) => void;
    onSelectAnnotation: (annotation: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>) => void;
    onDeleteAnnotation: (
      VideoAnnotation: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>,
      frame?: number,
    ) => void;
    onZoomChange?: (zoom: number) => void;
    onScaleChange?: (zoom: number) => void;
    db?: AnnotationsIndexedDB;
    isPlaying?: boolean;
  } = $props();

  // Contexts
  let context: IActivityContext = getContext("context");

  // Variables
  let isResizing: boolean = $state(false);

  let range_span = $derived(Math.min(scale * zoom, totalFrames));
  let manual_offset = 1;

  let pos_offset = $derived.by(() => {
    let offset = manual_offset;

    const isOutsideRange = currentFrame < offset || currentFrame > offset + range_span;

    if (isOutsideRange) {
      const centerOffset = currentFrame - Math.floor(range_span / 2);
      offset = Math.max(1, Math.min(totalFrames - range_span, centerOffset));

      if (isPlaying) {
        manual_offset = offset;
      }
    }

    return offset;
  });

  let range: [number, number] = $derived([pos_offset, Math.min(pos_offset + range_span, totalFrames)]);
  let wheelthrottling = $state(false);
  let hoveredColumn: number | undefined = $state();

  export function setOffset(offset: number) {
    pos_offset = Math.max(1, Math.min(totalFrames - range_span, offset || 0));
  }

  export function setZoom(value: number): void {
    const s = Math.min(150, Math.max(20, value));

    const minZoom = 20;
    const maxZoom = 150;
    const midZoom = (minZoom + maxZoom) / 2;

    // maximum scale based on new zoom value
    const maxScale = Math.ceil(totalFrames / s);

    // Determine new scale based on zoom value with smoother interpolation
    let newScale: number;
    if (s <= midZoom) {
      newScale = 1;
    } else {
      // Use smooth linear interpolation for scale when zoom > midZoom
      const scaleProgress = (s - midZoom) / (maxZoom - midZoom);
      newScale = 1 + scaleProgress * (maxScale - 1);
    }

    scale = Math.max(1, Math.round(newScale));
    zoom = s;

    // Recenter the range on current frame after zoom/scale change
    const newRangeSpan = Math.min(scale * zoom, totalFrames);
    const centerOffset = currentFrame - Math.floor(newRangeSpan / 2);
    setOffset(centerOffset);

    onScaleChange?.(scale);
    onZoomChange?.(zoom);
  }

  function seekToFrame(frameToGo: number) {
    onSeekFrame(frameToGo);
  }

  function getCategory(categoryId: string, shape_type: string) {
    return Object.entries(context.config)
      .find(([k, _]) => k == shape_type)?.[1]
      .values.find((cat) => cat.id === categoryId);
  }

  async function getCategoryName(
    categoryId: string | undefined,
    selected: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>,
  ) {
    if (!categoryId) return "Uncategorized";

    const selectedCategory = getCategory(categoryId, selected.shape.type);

    const selectedAnnotationIndex = await getSelectedAnnotationIndex(categoryId, selected.metadata.id);
    const selectedCategoryName = selectedCategory?.label || categoryId;

    return [selectedCategoryName, selectedAnnotationIndex].join("_");
  }

  async function getSelectedAnnotationIndex(categoryId: string, annotationId: string) {
    if (!db) return 0;

    return (await db.getAllIndex("category", categoryId)).findIndex(
      (annotation) => annotation.metadata.id == annotationId,
    ) as number;
  }

  function scrollRight(next: number) {
    setOffset(range[0] - next);
  }

  function scrollLeft(next: number) {
    setOffset(range[0] + next);
  }

  function zoomIn(next: number) {
    setZoom(zoom + next);
  }

  function zoomOut(next: number) {
    setZoom(zoom - next);
  }

  function scrollHorizontal(e: MouseEvent) {
    if (isResizing) {
      const isScrollToTheRight = e.movementX > 0;
      const isScrollToTheLeft = e.movementX < 0;

      if (isScrollToTheRight) {
        const next = Math.floor(range_span / 10);
        scrollRight(next);
      } else if (isScrollToTheLeft) {
        const next = Math.floor(range_span / 10);
        scrollLeft(next);
      }
    }
  }

  function handleRowClick(annotation: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>) {
    onSelectAnnotation(annotation);
    pos_offset = annotation.shape.start || 0;
    onSeekFrame(annotation.shape.start || 0);
  }

  let rowElements: Record<string, HTMLElement> = $state({});

  function trackRow(node: HTMLElement, params: { id: string; isSelected: boolean }) {
    rowElements[params.id] = node;

    return {
      update(newParams: { id: string; isSelected: boolean }) {
        // Scroll into view immediately when this row becomes selected
        if (newParams.isSelected && !params.isSelected) {
          node.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        }
        params = newParams;
      },
      destroy() {
        delete rowElements[params.id];
      },
    };
  }
</script>

{#snippet row(annotations: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>[])}
  {#each annotations as annotation, index (annotation.metadata.id)}
    {@const isSelected = selectedAnnotation?.metadata.id == annotation.metadata.id}
    {@const isLastIndex = index == annotations.length - 1}
    <TableRow
      class={cn("border-b-0", {
        "bg-primary/20": isSelected,
      })}
    >
      <td
        use:trackRow={{ id: annotation.metadata.id, isSelected }}
        class={cn("justify-end p-0", {
          "border-b": isLastIndex,
        })}
        onclick={() => {
          handleRowClick(annotation);
        }}
      >
        <button class={cn("group flex w-full cursor-pointer items-center justify-end px-2 py-1")}>
          {#await getCategoryName(annotation.value.category, annotation)}
            <Spinner size="sm"></Spinner>
          {:then title}
            <Text size="xs" weight={isSelected ? "semibold" : "normal"} class="text-foreground">
              {humanize(title)}
            </Text>
          {/await}

          <Button
            variant="ghost"
            size="icon"
            class={cn("ml-2 size-6 opacity-0 transition-opacity duration-200 ease-in-out group-hover:opacity-100", {
              "opacity-100": isSelected,
            })}
            onclick={(e) => {
              e.stopPropagation();
              onDeleteAnnotation(annotation);
            }}
          >
            <Trash2Icon class="size-3"></Trash2Icon>
          </Button>
        </button>
      </td>

      <TableCell class="p-0">
        <Timeline
          {annotation}
          {currentFrame}
          {range}
          {scale}
          {zoom}
          {totalFrames}
          onCellHover={(column) => (hoveredColumn = column)}
          {hoveredColumn}
          {onSeekFrame}
          {onSelectAnnotation}
          {onDeleteAnnotation}
        />
      </TableCell>
    </TableRow>
  {/each}
{/snippet}

{#snippet tooltipFrame(
  thisFrame: number,
  bgColor: string = "bg:secondary-foreground dark:bg-secondary",
  textColor: string = "text:secondary dark:text-secondary-foreground",
  extraClass: string = "",
)}
  <span
    class={cn(
      `${bgColor} ${textColor} pointer-events-none absolute top-0 left-1/2 z-50 -translate-x-1/2 transform rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-all duration-150`,
      extraClass,
    )}
  >
    {thisFrame}
    <span class={`absolute top-full left-1/2 -mt-1 h-1.5 w-1.5 -translate-x-1/2 rotate-45 ${bgColor}`}></span>
  </span>
{/snippet}

<Table
  onwheel={(e: WheelEvent) => {
    let from = $state.snapshot(pos_offset) as number;
    let delta = 0;
    if (!wheelthrottling) {
      wheelthrottling = true;
      setTimeout(() => (wheelthrottling = false), 10);

      if (e.ctrlKey && e.shiftKey) {
        setZoom(zoom - e.deltaY);
      } else if (e.ctrlKey) {
        delta = e.deltaY ? (e.deltaY > 0 ? 1 : -1) : 0; // for now
        let c_hovered = $state.snapshot(hoveredColumn);
        let c = c_hovered != undefined ? Math.ceil((c_hovered - pos_offset) / scale) : 0;

        if (c_hovered != undefined) {
          setOffset(c_hovered - c * scale);
        }
      } else {
        delta = e.shiftKey ? e.deltaY : e.deltaX;
        setOffset(Math.floor(pos_offset + delta * scale));
        if (hoveredColumn != undefined) {
          hoveredColumn += pos_offset - from;
        }
      }

      /** Handle Shift + Scroll to slide left or right */
      if (e.shiftKey) {
        const isScrollUp = e.deltaX < 0;
        const isScrollDown = e.deltaX > 0;

        const next = Math.floor(range_span / 4);

        if (isScrollUp) scrollRight(next);
        else if (isScrollDown) scrollLeft(next);
      }

      if (e.metaKey) {
        const isScrollUp = e.deltaY < 0;
        const isScrollDown = e.deltaY > 0;

        const to = scale * (zoom / 10);

        if (isScrollUp) zoomIn(to);
        else if (isScrollDown) zoomOut(to);
      }
    }
    if (delta || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) e.preventDefault();
  }}
>
  <TableHeader class="bg-background sticky z-40" style="inset-block-start: 0">
    <TableRow>
      <!-- HEADER::ANNOTATIONS -->
      <TableHead class="h-7 w-60"></TableHead>

      <!-- HEADER::TIMELINES -->
      <TableHead class="h-7 p-0">
        <div
          role="scrollbar"
          aria-controls="timeline-table"
          aria-valuenow={pos_offset}
          tabindex="0"
          class="text-muted-foreground group relative h-7"
          onmousedowncapture={() => {
            isResizing = true;
          }}
          onmousemove={scrollHorizontal}
          onmouseupcapture={() => {
            isResizing = false;
          }}
        >
          {#each Array.from({ length: (() => {
                const span = range[1] - range[0]; // actual range span
                const padding = (scale - (span % scale)) % scale; // align to scale
                // clamp to range length
                return Math.min(span + padding + 1, range[1] - range[0] + 1);
              })() }, (_, i) => i) as i (i)}
            {@const thisFrame = i + range[0]}
            {@const width = (1 / ((range[1] - range[0] + (scale - (range_span % scale))) / 100)) * scale}
            {@const isSelected = Math.floor(thisFrame) == currentFrame}
            {@const isHovered = thisFrame == hoveredColumn}
            {@const cellIndex = Math.floor(i / scale)}
            {@const isDefault = cellIndex % Math.floor(zoom / Math.min(zoom, 20)) == 0 && i % scale == 0}
            {@const isTick = i % scale == 0}
            {@const startLeftPosition = (i / (range[1] - range[0] + (scale - (range_span % scale)))) * 100}
            {@const isOutOfRange = thisFrame > totalFrames}

            {#if !isOutOfRange && isSelected}
              <button
                class="border-border text-primary bg-background absolute top-0 z-40 h-full cursor-col-resize border-l"
                style:width="{width}%"
                style:padding-left="0.125rem"
                style:left="{startLeftPosition}%"
                onclick={() => seekToFrame(thisFrame)}
              >
                <div
                  class="bg-primary absolute top-0 left-1/2 z-50 w-0.5 -translate-x-1/2"
                  style="min-height: 24vh;"
                ></div>
                {@render tooltipFrame(thisFrame, "bg-primary", "text-primary-foreground")}
              </button>
            {:else if !isOutOfRange && isDefault}
              <button
                class={cn("border-border text-muted-foreground/50 absolute top-0 h-full cursor-pointer border-l", {
                  "z-40": isHovered,
                  "z-0": !isHovered,
                })}
                style:width="{width}%"
                style:left="{startLeftPosition}%"
                onclick={() => seekToFrame(thisFrame)}
                onmouseenter={() => (hoveredColumn = thisFrame)}
                onmouseleave={() => (hoveredColumn = undefined)}
              >
                {#if isHovered}
                  <div
                    class="bg-secondary-foreground absolute top-0 left-1/2 z-50 w-0.5 -translate-x-1/2 dark:bg-gray-700"
                    style="min-height: 24vh;"
                  ></div>
                  {@render tooltipFrame(
                    thisFrame,
                    "bg-secondary-foreground dark:bg-gray-700",
                    "text-secondary dark:text-secondary-foreground",
                  )}
                {:else}
                  {thisFrame}
                {/if}
              </button>
            {:else if !isOutOfRange && isTick}
              <button
                aria-label="tick"
                class={cn("border-border absolute bottom-0 cursor-pointer border-l", {
                  "z-40": isHovered,
                  "z-0": !isHovered,
                })}
                style:height="60%"
                style:width="{width}%"
                style:left="{startLeftPosition}%"
                onclick={() => seekToFrame(thisFrame)}
                onmouseenter={() => (hoveredColumn = thisFrame)}
                onmouseleave={() => (hoveredColumn = undefined)}
              >
                {#if isHovered}
                  <div
                    class="bg-secondary-foreground absolute top-0 left-1/2 z-50 w-0.5 -translate-x-1/2 dark:bg-gray-700"
                    style="min-height: 24vh;"
                  ></div>
                  {@render tooltipFrame(
                    thisFrame,
                    "bg-secondary-foreground dark:bg-gray-700",
                    "text-secondary dark:text-secondary-foreground",
                    "-top-2.5",
                  )}
                {/if}
              </button>
            {/if}
          {/each}
        </div>
      </TableHead>
    </TableRow>
  </TableHeader>

  <TableBody>
    {#await annotations_promise}
      {@render row($boundingBoxes)}
    {:then annotations}
      {@render row(annotations)}
    {/await}
  </TableBody>
</Table>
