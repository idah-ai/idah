<script lang="ts">
  import { getContext } from "svelte";

  import { Button } from "@/components/ui/button";
  import Spinner from "@/components/app/loading/spinner.svelte";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
  import Text from "@/components/ui/text/Text.svelte";

  import { cn } from "@/utils";
  import { humanize } from "@/utils/string";
  import { Trash2Icon } from "@lucide/svelte";
  import type { LabelingConfiguration } from "@/data/model/dataset/labels";

  import Timeline from "./timeline.svelte";
  import { boundingBoxes } from "../idb_store.svelte";
  import type { VideoAnnotation } from "../VideoAnnotationContext";
  import type { AnnotationsIndexedDB } from "../indexedDB";

  // Props
  let {
    // tracking = false,
    scale = 1,
    zoom = 1,
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
  }: {
    annotations_promise: Promise<VideoAnnotation[]>;
    // tracking?: boolean;
    scale: number;
    zoom: number;
    currentFrame: number;
    totalFrames: number;
    selectedAnnotation?: VideoAnnotation;
    onSeekFrame: (frame: number) => void;
    onSelectAnnotation: (annotation: VideoAnnotation) => void;
    onDeleteAnnotation: (VideoAnnotation: VideoAnnotation, frame?: number) => void;
    onZoomChange?: (zoom: number) => void;
    onScaleChange?: (zoom: number) => void;
    db?: AnnotationsIndexedDB;
  } = $props();

  // Contexts
  let labelConfig: LabelingConfiguration = getContext("labelConfig");

  // Variables
  let isResizing: boolean = $state(false);

  // $effect(() => {
  //     if (tracking) {
  //         if (currentFrame < pos_offset)
  //         setOffset(currentFrame)
  //         else if (currentFrame > pos_offset + range_span)
  //         setOffset(currentFrame - range_span)
  //     }
  // })

  let range_span = $derived(Math.min(scale * zoom, totalFrames));

  let pos_offset: number = $state(0);
  let range: [number, number] = $derived([pos_offset, pos_offset + range_span]);

  let wheelthrottling = $state(false);
  let hoveredColumn: number | undefined = $state();

  export function setOffset(offset: number) {
    pos_offset = Math.max(0, Math.min(Math.ceil(totalFrames - (range_span + 1)), offset || 0));
  }

  export function setZoom(value: number) {
    const s = Math.min(150, Math.max(1, Math.round(value)));
    scale = Math.min(scale, Math.ceil(totalFrames / s));
    zoom = s;
    onZoomChange?.(zoom);
  }

  export function setScale(value: number) {
    scale = Math.max(1, Math.min(Math.ceil(totalFrames / zoom), value));
    onScaleChange?.(scale);
  }

  function seekToFrame(frameToGo: number) {
    onSeekFrame(frameToGo);
  }

  function getCategory(categoryId: string) {
    return labelConfig.categories.find((cat) => cat.id === categoryId);
  }

  async function getCategoryName(categoryId: string | undefined, selected: VideoAnnotation) {
    if (!categoryId) return "Uncategorized";

    const selectedCategory = getCategory(categoryId);

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
      const isScrollToTheRight = e.movementX < 0;
      const isScrollToTheLeft = e.movementX > 0;

      if (isScrollToTheRight) {
        const next = Math.floor(range_span / 10);
        scrollRight(next);
      } else if (isScrollToTheLeft) {
        const next = Math.floor(range_span / 10);
        scrollLeft(next);
      }
    }
  }
</script>

{#snippet row(annotations: VideoAnnotation[])}
  {#each annotations as annotation, index (annotation.metadata.id)}
    {@const isSelected = selectedAnnotation?.metadata.id == annotation.metadata.id}
    {@const isLastIndex = index == annotations.length - 1}
    <TableRow
      class={cn("border-b-0", {
        "bg-primary-foreground border-primary/30 border-b border-t": isSelected,
      })}
    >
      <TableCell
        class={cn("justify-end p-0", {
          "border-b": isLastIndex,
        })}
        onclick={() => {
          onSelectAnnotation(annotation);
          pos_offset = annotation.shape.start;
          onSeekFrame(annotation.shape.start);
        }}
      >
        <button class={cn("group flex w-full cursor-pointer items-center justify-end px-2 py-1")}>
          {#await getCategoryName(annotation.value.category, annotation)}
            <Spinner size="sm"></Spinner>
          {:then title}
            <Text size="sm" weight={isSelected ? "semibold" : "normal"}>{humanize(title)}</Text>
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
      </TableCell>

      <TableCell class="p-0">
        <Timeline
          {annotation}
          {currentFrame}
          {range}
          {scale}
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

        setScale(scale + delta);
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

        if (isScrollUp) {
          scrollRight(next);
        } else if (isScrollDown) {
          scrollLeft(next);
        }
      }

      /** Handle CMD + Scroll to zoom in or out */
      if (e.metaKey) {
        const isScrollUp = e.deltaY < 0;
        const isScrollDown = e.deltaY > 0;

        const to = scale * (zoom / 10);

        if (isScrollUp) {
          zoomIn(to);
        } else if (isScrollDown) {
          zoomOut(to);
        }
      }
    }
    if (delta || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) e.preventDefault();
  }}
>
  <TableHeader class="bg-background sticky z-10" style="inset-block-start: 0">
    <TableRow>
      <!-- HEADER::ANNOTATIONS -->
      <TableHead class="h-5 w-80"></TableHead>

      <!-- HEADER::TIMELINES -->
      <TableHead class="h-5 p-0">
        <div
          role="scrollbar"
          aria-controls="timeline-table"
          aria-valuenow={pos_offset}
          tabindex="0"
          class="text-muted-foreground relative h-5"
          onmousedowncapture={() => {
            isResizing = true;
          }}
          onmousemove={scrollHorizontal}
          onmouseupcapture={() => {
            isResizing = false;
          }}
        >
          {#each [...Array(range[1] - range[0] + (scale - (range_span % scale)))].map((v, i) => i) as i (i)}
            {@const thisFrame = i + range[0]}
            {@const width = (1 / ((range[1] - range[0] + (scale - (range_span % scale))) / 100)) * scale}
            {@const isSelected = Math.floor(thisFrame) == currentFrame}
            {@const isHovered = thisFrame == hoveredColumn}
            {@const isDefault =
              i % (Math.floor(zoom / Math.min(zoom, 20)) * Math.ceil((range[1] - range[0]) / zoom)) == 0}
            {@const isTick = i % (1 * Math.ceil((range[1] - range[0]) / zoom)) == 0}
            {@const startLeftPosition = (i / (range[1] - range[0] + (scale - (range_span % scale)))) * 100}

            {#if isSelected}
              <button
                class="border-border text-primary bg-background absolute top-0 z-20 cursor-col-resize border-b border-l"
                style:width="{width}%"
                style:padding-left="0.125rem"
                style:left="{startLeftPosition}%"
                onclick={() => seekToFrame(thisFrame)}
              >
                {thisFrame}
              </button>
            {:else if isHovered}
              <button
                class="border-border text-primary bg-primary/20 absolute top-0 z-10 cursor-col-resize border-l"
                style:width="{width}%"
                style:padding-left="0.125rem"
                style:left="{startLeftPosition}%"
                onclick={() => seekToFrame(thisFrame)}
              >
                {thisFrame}
              </button>
            {:else if isDefault}
              <button
                class="border-border text-muted-foreground/50 absolute top-0 cursor-col-resize border-l"
                style:width="{width}%"
                style:padding-left="0.125rem"
                style:left="{startLeftPosition}%"
                onclick={() => seekToFrame(thisFrame)}
              >
                {thisFrame}
              </button>
            {:else if isTick}
              <button
                aria-label="tick"
                class="border-border absolute bottom-0 cursor-col-resize border-l"
                style:height="60%"
                style:width="100%"
                style:left="{startLeftPosition}%"
                onclick={() => seekToFrame(thisFrame)}
              ></button>
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
