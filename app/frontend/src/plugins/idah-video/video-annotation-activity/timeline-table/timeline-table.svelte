<script lang="ts">
	import { Button } from "@/components/ui/button";
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
	import type { VideoAnnotation } from "../VideoAnnotationContext";
	import Timeline from "./timeline.svelte";
    import type { AnnotationsIndexedDB } from "../indexedDB";
    import { boundingBoxes, idb_updated_at } from "../idb_store.svelte";

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
	}: {
        annotations_promise: VideoAnnotation[],
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
                class="hoverable p-0"
                ondblclick={() => {
                    pos_offset = annotation.shape.start;
                    onSeekFrame(annotation.shape.start);
                }}
            >
                {[annotation.value.category?.split("/").reverse()[0], annotation.metadata.id].filter((a) => a).join(" - ")}

                <Button
                    class='hovered'
                    onclick={(e) => {
                        e.stopPropagation();
                        onDeleteAnnotation(annotation);
                    }}>
                    <svg class='h-100' viewBox="0 0 12 15" xmlns="http://www.w3.org/2000/svg">
                        <path
                            class="fill-secondary"
                            d="M9.33329 5V13.3333H2.66663V5H9.33329ZM8.08329 0H3.91663L3.08329 0.833333H0.166626V2.5H11.8333V0.833333H8.91663L8.08329 0ZM11 3.33333H0.999959V13.3333C0.999959 14.25 1.74996 15 2.66663 15H9.33329C10.25 15 11 14.25 11 13.3333V3.33333Z"
                        />
                    </svg>
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
                display:inline-block
            }
            .hoverable .hovered {
                display:none
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
				delta = e.deltaY ? (e.deltaY > 0 ? 1 : -1) : 0 // for now
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


