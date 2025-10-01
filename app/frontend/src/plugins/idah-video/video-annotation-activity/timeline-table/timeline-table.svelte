<script lang="ts">
  import { Button } from "@/components/ui/button";
  import { boundingBoxes } from "../idb_store.svelte";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { page } from "$app/state";
  import { Slider } from "@/components/ui/slider";
  import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
  import Timeline from "./timeline.svelte";
  import Trash_2 from "@lucide/svelte/icons/trash-2";
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
    annotations_promise: VideoAnnotation[];
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
    <TableRow
      class="border-0"
      onclick={() => {
        onSelectAnnotation(annotation);
      }}
      data-state={selectedAnnotation?.metadata.id == annotation.metadata.id ? "selected" : ""}
    >
      <TableCell
        class="hoverable flex justify-between p-0"
        ondblclick={() => {
          pos_offset = annotation.shape.start;
          onSeekFrame(annotation.shape.start);
        }}
      >
        {#await getCategoryName(annotation.value.category, annotations, annotation)}
          <span>Loading...</span>
        {:then title}
          <span class="px-2">{title}</span>
        {/await}

        <Button
          class="hovered"
          onclick={(e) => {
            e.stopPropagation();
            onDeleteAnnotation(annotation);
          }}
        >
          <Trash_2></Trash_2>
        </Button>
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
    <style>
      .hoverable:hover .hovered {
        display: inline-block;
      }
      .hoverable .hovered {
        display: none;
      }
    </style>
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
    }
    if (delta || e.ctrlKey || e.shiftKey || e.altKey) e.preventDefault();
  }}
>
  <TableCaption>Annotations List</TableCaption>
  <TableHeader class="sticky z-10" style={"inset-block-start:0"}>
    <TableRow>
      <TableHead class="w-100"></TableHead>
      <TableHead class="p-0">
        <div class="bg-secondary border-primary relative h-5" style:border-bottom="solid 1px">
          {#each [...Array(range[1] - range[0] + (scale - (range_span % scale)))].map((v, i) => i) as i}
            {#if Math.floor(i + range[0]) == currentFrame}
              <div
                class="bg-primary text-secondary border-primary absolute top-0 z-10"
                style:left="{(i / (range[1] - range[0] + (scale - (range_span % scale)))) * 100}%"
                style:border-left="solid 1px"
              >
                {i + range[0]}
              </div>
            {:else if i + range[0] == hovered_column}
              <div
                class="bg-destructive absolute top-0 z-10 border"
                style:left="{(i / (range[1] - range[0] + (scale - (range_span % scale)))) * 100}%"
                style:border-left="solid 1px"
              >
                {i + range[0]}
              </div>
            {:else if i % (Math.floor(zoom / Math.min(zoom, 20)) * Math.ceil((range[1] - range[0]) / zoom)) == 0}
              <div
                class="border-primary absolute top-0"
                style:border-left="solid 1px"
                style:left="{(i / (range[1] - range[0] + (scale - (range_span % scale)))) * 100}%"
              >
                {i + range[0]}
              </div>
            {:else if i % (1 * Math.ceil((range[1] - range[0]) / zoom)) == 0}
              <div
                class="border-primary absolute bottom-0"
                style:height="0.6em"
                style:border-left="solid 1px"
                style:left="calc({(i / (range[1] - range[0] + (scale - (range_span % scale)))) * 100}%)"
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
