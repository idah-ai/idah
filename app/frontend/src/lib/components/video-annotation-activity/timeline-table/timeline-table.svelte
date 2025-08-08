<script lang='ts'>
	import { Button } from "@/components/ui/button";
	import { Slider } from "@/components/ui/slider";
	import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
	import type { VideoAnnotation } from "../VideoAnnotationContext";
	import Timeline from "./timeline.svelte";

    let {
        tracking = false,
        current_frame,
        total_frames,
        annotations,
        selectedAnnotation,
        onSeekFrame,
        onDeleteAnnotation,
        onSelectAnnotation,
        onScaleChange,
        onTimelineZoomChange
    } : {
        tracking?:boolean
        current_frame: number
        total_frames: number
        selectedAnnotation?: VideoAnnotation,
        annotations: VideoAnnotation[],
        onSeekFrame: (frame:number) => void,
        onSelectAnnotation: (annotation:VideoAnnotation) => void,
        onDeleteAnnotation: (VideoAnnotation: VideoAnnotation, frame?: number) => void
        onScaleChange?: (scale:number) => void,
        onTimelineZoomChange?: (zoom:number) => void,
    } = $props()

    $effect(() => {
        onScaleChange?.(scale)
    })
    $effect(() => {
        onTimelineZoomChange?.(timeline_zoom)
    })

    // $effect(() => {
    //     if (tracking) {
    //         if (current_frame < pos_offset)
    //         setOffset(current_frame)
    //         else if (current_frame > pos_offset + range_span)
    //         setOffset(current_frame - range_span)
    //     }
    // })

    let timeline_zoom = $state(1)
    let scale = $state(100)
    let range_span = $derived(Math.min((timeline_zoom * scale), total_frames))

    let pos_offset:number = $state(0)
    let range:[number, number] = $derived([pos_offset, pos_offset + range_span])

    let wheelthrottling = $state(false)
    let hovered_column :number|undefined = $state()

    export function setOffset(offset: number) {
        pos_offset = Math.max(
            0,
            Math.min(
                Math.ceil(total_frames - (range_span + 1)),
                offset || 0
            )
        )
    }

    export function setScale(value: number) {
        const s = Math.min(150, Math.max(1, Math.round(value)))
        timeline_zoom = Math.min(timeline_zoom, Math.ceil(total_frames/s))
        scale = s
    }

    export function setTimelineZoom(value: number){
        timeline_zoom = Math.max(1, Math.min(Math.ceil(total_frames / scale), value))
    }

</script>

<Table
    onwheel={(e: WheelEvent) => {
    let from = $state.snapshot(pos_offset) as number
    let delta = 0
    if (!wheelthrottling) {
    wheelthrottling = true
    setTimeout(()=> wheelthrottling = false, 10)

    if (e.ctrlKey && e.shiftKey) {
        setScale(scale - e.deltaY)
    }
    else if (e.ctrlKey) {
        delta = Math.ceil(e.deltaY)
        let c_hovered = $state.snapshot(hovered_column)
        let c = c_hovered != undefined ? Math.ceil((c_hovered - pos_offset) / timeline_zoom) : 0

        setTimelineZoom(timeline_zoom + delta)
        if (c_hovered != undefined) {setOffset(c_hovered - (c * timeline_zoom))}
    } else {
        delta = (e.shiftKey? e.deltaY : e.deltaX)
        setOffset(Math.floor(pos_offset + delta * timeline_zoom))
        if (hovered_column != undefined) { hovered_column +=(pos_offset - from)}
    }
    }
    if (delta || e.ctrlKey || e.shiftKey || e.altKey)
    e.preventDefault()
    }}>
    <TableCaption>Annotations List</TableCaption>
    <TableHeader class='sticky z-10' style={'inset-block-start:0'}>
        <TableRow>
        <TableHead class="w-100"></TableHead>
        <TableHead  class='p-0'>
            <div class='relative bg-secondary h-5 border-primary' style:border-bottom="solid 1px">

            {#each [...Array(range[1]-range[0]+ (timeline_zoom - (range_span % timeline_zoom)))].map((v, i) => i) as i }
                    {#if Math.floor((i + range[0])) == current_frame}
                    <div class='absolute top-0 bg-primary text-secondary z-10 border-primary' style:left={i / (range[1]-range[0]+ (timeline_zoom - (range_span % timeline_zoom))) * 100}% style:border-left="solid 1px">
                        {i + range[0]}
                    </div>
                    {:else if i + range[0] == hovered_column}
                    <div class='absolute top-0 bg-destructive z-10 border'
                        style:left={i / (range[1]-range[0]+ (timeline_zoom - (range_span % timeline_zoom))) * 100}%
                        style:border-left="solid 1px"
                    >
                        {i + range[0]}
                    </div>
                    {:else if i % (Math.floor(scale/Math.min(scale, 20)) *Math.ceil(((range[1]-range[0]) / scale)))  == 0}
                    <div class='absolute top-0 border-primary'
                        style:border-left="solid 1px"
                        style:left={i / (range[1]-range[0]+ (timeline_zoom - (range_span % timeline_zoom))) * 100}%
                    > {i + range[0]}
                    </div>
                    {:else if i % (1 * Math.ceil(((range[1]-range[0]) / scale)))  == 0}
                    <div class='absolute bottom-0 border-primary'
                     style:height=0.6em
                     style:border-left="solid 1px"
                     style:left="calc({i / (range[1]-range[0]+ (timeline_zoom - (range_span % timeline_zoom))) * 100}%)">
                    </div>
                    {/if}
            {/each}
            </div>
        </TableHead>
        </TableRow>
    </TableHeader>
    {#if range_span != total_frames}
    <TableFooter class='sticky z-10' style={'inset-block-end:0'}>
        <TableRow>
            <TableCell></TableCell>
            <TableCell>
                <Slider type='multiple'
                    min={0}
                    max={Math.max(0, total_frames - 1)}
                    step={1}
                    value={range}
                    onValueChange={(v) => {
                        if (v[0] == range[0]) {
                        setOffset(v[1] - range_span)
                        } else {
                        setOffset(v[0])
                        }
                    }}
                    />
            </TableCell>
        </TableRow>
    </TableFooter>
    {/if}
    <TableBody>
        {#each annotations as annotation :videoAnnotation}
        <TableRow class='border-0' onclick={() => {onSelectAnnotation(annotation)}}
            data-state={selectedAnnotation == annotation? 'selected':''}>
            <TableCell
                class='p-0'
                ondblclick={() => {
                    pos_offset = annotation.shape.start
                    onSeekFrame(annotation.shape.start)
                }}
                >
                {
                    [
                        annotation.value.category?.split('/').reverse()[0],
                        annotation.metadata.id
                    ].filter(a => a).join(' - ')
                }
                <Button onclick={(e) => {
                e.stopPropagation()
                onDeleteAnnotation(annotation)
               }}>X</Button>
            </TableCell>
            <TableCell class='p-0'>
            <Timeline
                {annotation}
                {current_frame}
                {range}
                {timeline_zoom}
                hoveredColumnChange={(column) => hovered_column = column}
                {hovered_column}
                {onSeekFrame}
                {onDeleteAnnotation}
            />
            </TableCell>
        </TableRow>
        {/each}
    </TableBody>
</Table>
