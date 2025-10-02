<script lang="ts">
  import { Button } from "@/components/ui/button";
  import { boundingBoxes } from "../idb_store.svelte";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { page } from "$app/state";
  import { Slider } from "@/components/ui/slider";
  import Spinner from "@/components/app/loading/spinner.svelte";
  import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
  import Text from "@/components/ui/text/Text.svelte";
  import Timeline from "./timeline.svelte";

  import { cn } from "@/utils";
  import { humanize } from "@/utils/string";
  import { Trash2Icon } from "@lucide/svelte";

  import type { VideoAnnotation } from "../VideoAnnotationContext";
  import type { AnnotationsIndexedDB } from "../indexedDB";

  // Props
  let {
    tracking = false,
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
    tracking?: boolean;
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

  $effect(() => {
    onZoomChange?.(zoom);
  });
  $effect(() => {
    onScaleChange?.(scale);
  });

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
  let hovered_column: number | undefined = $state();

  export function setOffset(offset: number) {
    pos_offset = Math.max(0, Math.min(Math.ceil(totalFrames - (range_span + 1)), offset || 0));
  }

  export function setZoom(value: number) {
    const s = Math.min(150, Math.max(1, Math.round(value)));
    scale = Math.min(scale, Math.ceil(totalFrames / s));
    zoom = s;
  }

  export function setScale(value: number) {
    scale = Math.max(1, Math.min(Math.ceil(totalFrames / zoom), value));
  }

  async function getCategoryName(
    categoryId: string | undefined,
    annotations: VideoAnnotation[],
    selected: VideoAnnotation,
  ) {
    if (!categoryId) return "Uncategorized";
    const entryId = page.params.entryId as string;
    const entryResponse = await entriesBackendDataSource.get(entryId, {
      fields: {
        [DatasetRecord.type]: ["labeling_configuration"],
      },
      included: ["dataset"],
    });
    const labelingConfiguration = entryResponse?.data.dataset.labeling_configuration;
    const index = await getSelectedAnnotationIndex(categoryId, selected.metadata.id);
    const titleName = labelingConfiguration?.categories?.find((c) => c.id === categoryId)?.label || categoryId;

    return [titleName, index].join("_");
  }

  async function getSelectedAnnotationIndex(categoryId: string, annotationId: string) {
    if (!db) return 0;

    return (await db.getAllIndex("category", categoryId)).findIndex(
      (annotation) => annotation.metadata.id == annotationId,
    ) as number;
  }
</script>

{#snippet row(annotations: VideoAnnotation[])}
  {#each annotations as annotation}
    {@const isSelected = selectedAnnotation?.metadata.id == annotation.metadata.id}
    <TableRow
      class={cn("border-b-0", {
        "bg-primary-foreground": isSelected,
      })}
    >
      <TableCell
        class="p-0"
        onclick={() => {
          onSelectAnnotation(annotation);
          pos_offset = annotation.shape.start;
          onSeekFrame(annotation.shape.start);
        }}
      >
        <button class={cn("group flex w-full cursor-pointer items-center px-2 py-1")}>
          {#await getCategoryName(annotation.value.category, annotations, annotation)}
            <Spinner size="sm"></Spinner>
          {:then title}
            <Text size="sm">{humanize(title)}</Text>
          {/await}

          <Button
            variant="ghost"
            size="icon"
            class={cn("ml-auto size-6 opacity-0 transition-opacity duration-200 ease-in-out group-hover:opacity-100", {
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
          hoveredColumnChange={(column) => (hovered_column = column)}
          {hovered_column}
          {onSeekFrame}
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
        let c_hovered = $state.snapshot(hovered_column);
        let c = c_hovered != undefined ? Math.ceil((c_hovered - pos_offset) / scale) : 0;

        setScale(scale + delta);
        if (c_hovered != undefined) {
          setOffset(c_hovered - c * scale);
        }
      } else {
        delta = e.shiftKey ? e.deltaY : e.deltaX;
        setOffset(Math.floor(pos_offset + delta * scale));
        if (hovered_column != undefined) {
          hovered_column += pos_offset - from;
        }
      }

      if (e.shiftKey) {
        // console.log("scroll", e.wheelDeltaX);
      }
    }
    if (delta || e.ctrlKey || e.shiftKey || e.altKey) e.preventDefault();
  }}
>
  <TableHeader class="sticky z-10" style={"inset-block-start:0"}>
    <TableRow>
      <TableHead class="w-100"></TableHead>
      <TableHead class="p-0">
        <div class="text-muted-foreground relative h-5 border-b">
          {#each [...Array(range[1] - range[0] + (scale - (range_span % scale)))].map((v, i) => i) as i}
            {@const width = (1 / ((range[1] - range[0] + (scale - (range_span % scale))) / 100)) * scale}
            {@const isSelected = Math.floor(i + range[0]) == currentFrame}
            {@const isHovered = i + range[0] == hovered_column}
            {@const isDefault =
              i % (Math.floor(zoom / Math.min(zoom, 20)) * Math.ceil((range[1] - range[0]) / zoom)) == 0}
            {@const isTick = i % (1 * Math.ceil((range[1] - range[0]) / zoom)) == 0}
            {@const startLeftPosition = (i / (range[1] - range[0] + (scale - (range_span % scale)))) * 100}

            {#if isSelected}
              <div
                class="border-border bg-primary text-primary-foreground absolute top-0 z-10 border-l"
                style:width="{width}%"
                style:padding-left="0.125rem"
                style:left="{startLeftPosition}%"
              >
                {i + range[0]}
              </div>
            {:else if isHovered}
              <div
                class="border-border text-primary bg-primary-foreground absolute top-0 z-10 border-l"
                style:width="{width}%"
                style:padding-left="0.125rem"
                style:left="{startLeftPosition}%"
              >
                {i + range[0]}
              </div>
            {:else if isDefault}
              <div
                class="border-border absolute top-0 border-l"
                style:width="{width}%"
                style:padding-left="0.125rem"
                style:left="{startLeftPosition}%"
              >
                {i + range[0]}
              </div>
            {:else if isTick}
              <div
                class="border-border absolute bottom-0 border-l"
                style:height="0.6em"
                style:left="calc({startLeftPosition}%)"
              ></div>
            {/if}
          {/each}
        </div>
      </TableHead>
    </TableRow>
  </TableHeader>
  {#if range_span != totalFrames}
    <TableFooter class="sticky z-10" style={"inset-block-end:0"}>
      <TableRow>
        <TableCell></TableCell>
        <TableCell>
          <Slider
            type="multiple"
            min={0}
            max={Math.max(0, totalFrames - 1)}
            step={1}
            value={range}
            onValueChange={(v) => {
              if (v[0] == range[0]) {
                setOffset(v[1] - range_span);
              } else {
                setOffset(v[0]);
              }
            }}
          />
        </TableCell>
      </TableRow>
    </TableFooter>
  {/if}

  <TableBody>
    {#await annotations_promise}
      {@render row($boundingBoxes)}
    {:then annotations}
      {@render row(annotations)}
    {/await}
  </TableBody>
</Table>
