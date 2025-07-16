<script lang="ts">
	import SvgOverlay from '@/components/video-annotation-activity/svg-overlay.svelte';
	import ToolSidebar from './video-annotation-activity/tool-sidebar.svelte';
	import Controls from './video-annotation-activity/controls.svelte';
	import Video from './video-annotation-activity/video.svelte';
	import videoActivityContext from "@/components/video-annotation-activity/VideoActivityContext";
	import {type Point, type VideoAnnotation, type VideoAnnotationContext, type VideoMode, type VideoShape, type VideoShapeType, type VideoFrameSelection} from "@/components/video-annotation-activity/VideoAnnotationContext";
	import AnnotationSidebar from "./video-annotation-activity/annotation-sidebar.svelte";
	import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "./ui/resizable";
	import SidebarProvider from './ui/sidebar/sidebar-provider.svelte';
	import SidebarInset from './ui/sidebar/sidebar-inset.svelte';
	import type { AnnotationValue } from '@/context/AnnotationContext';
	import CommandManager from '@/command/CommandManager';
	import Navbar from './video-annotation-activity/navbar.svelte';
	import type { Command } from '@/command/Command';
	import { Toaster } from './ui/sonner';
	import Button from './ui/button/button.svelte';
	import { showErrorToast } from '@/utils/error/error.toasts';

    let player: Video
    let player_container: HTMLDivElement|undefined = $state() // ...
	let volume: number = $state(0)
    let current_frame = $state(0)
    let total_frames = $state(0)

    let mode:VideoMode = $state('view')

    let selectedAnnotation :VideoAnnotation|undefined = $state()
    let annotationValue:AnnotationValue= $derived(selectedAnnotation?.value || {})

    let annotations: Array<VideoAnnotation> = $state([])

    let id = $state(0) // ..
    function addAnnotation(
        shape: VideoShape, value: AnnotationValue = {}
    ) {
        let annotation = {
            shape,
            value,
            metadata: { // \_o_/
                id: (id += 1).toString(),
                createdAt: new Date(),
                updatedAt: new Date()
            }
        }
         const cmd = {
            name: 'new annotation',
            apply() {
                annotations.push(annotation)
            },
            undo()
            {
                if (annotation.metadata.id == selectedAnnotation?.metadata.id) selectedAnnotation = undefined
                annotations = annotations.filter((v) => {
                    return v.metadata.id != annotation.metadata.id
                })
            },
            isCombinable: () => false,
            combine: () => cmd
        }
        CommandManager.add(cmd)
    }

    function removeAnnotation(id: string){
        const annotation = annotations.find((v) => v.metadata.id == id)

        if (!annotation) return console.warn({removeAnnotation, annotation})

        const cmd = {
            name: 'remove annotation',
            apply() {
                if (id == selectedAnnotation?.metadata.id) selectedAnnotation = undefined
                annotations = annotations.filter((v) => {
                    return v.metadata.id != id
                })
            },
            undo()
            {
                annotations = [
                    ...annotations.filter((v) => {
                        return v.metadata.id != id
                    }),
                    annotation
                ]
            },
            isCombinable: () => false,
            combine: () => cmd
        }
        CommandManager.add(cmd)
    }
    function getAnnotationInfo(id: string) {
        return annotations.find((v) => v.metadata.id == id)
    }

    function addSelection(id: string, selection: VideoFrameSelection) {
            let v = getAnnotationInfo(id)

            if (!v) return console.warn({addSelection, annotation: v})

            const from = v.shape.frames.find(f => f.frame == selection.frame)
            const start = v.shape.start
            const end = v.shape.end

            const cmd:Command = {
                    name: 'add bounding box selection',
                    apply() {
                        v.shape = {
                            ...v.shape,
                            start: v.shape.start <= selection.frame ? v.shape.start : selection.frame,
                            end: v.shape.end >= selection.frame ? v.shape.end :selection.frame,
                            frames: [
                                ...v.shape.frames.filter(f => f.frame != selection.frame),
                                selection
                            ]
                        }
                    },
                    undo()
                    {
                        v.shape = {
                            ...v.shape,
                            start,
                            end,
                            frames: from ? [
                                ...v.shape.frames.filter(f => f.frame != selection.frame),
                                from
                            ] : v.shape.frames.filter(f => f.frame != selection.frame)
                        }
                    },
                    isCombinable: () => false,

                    combine: (c)=> cmd
                }
            CommandManager.add(cmd)
    }

    function onShapeSelection(type: VideoShapeType, frame:number, points: Point[] = [],selectedId?:string){
        console.log({type, frame, points: $state.snapshot(points), selectedId})
        if (!selectedId) {
                let annotation_value_from = $state.snapshot(annotationValue) as AnnotationValue
                addAnnotation({
                    type,
                    start: frame,
                    end: frame,

                    frames: [{ frame, points }],
                }, annotation_value_from)
        } else {
            addSelection(selectedId, {frame, points})
        }
    }

    function updateAnnotationValue(annotation:VideoAnnotation, value:AnnotationValue) {
        const annotation_id = annotation.metadata.id
        const value_from = annotation.value

        const cmd:Command = {
            name: 'update annotation value',
            apply() {
                const annotation = getAnnotationInfo(annotation_id)
                if (annotation) annotation.value = value
            },
            undo(){
                const annotation = getAnnotationInfo(annotation_id)
                if (annotation) annotation.value = value_from
            },
            isCombinable: () => false,
            combine: (c)=> cmd
        }

        CommandManager.add(cmd)
    }

    function selectAnnotation(annotation?: VideoAnnotation) {
        console.debug({selected: $state.snapshot(annotation), previous: selectedAnnotation})
        selectedAnnotation = annotation
        mode = annotation?.shape.type || 'view'
    }
</script>

<div class="flex flex-col h-screen w-full">
    <Navbar context={videoActivityContext}/>

    <Toaster position='bottom-center'/>
    <SidebarProvider
        class='min-h-0 w-full'
        style={
            'height:calc(100% - 30px)' // .. navbar
        }
        >
        <ResizablePaneGroup direction="vertical">
            <ResizablePane class="flex h-full" defaultSize={60} minSize={10} >
                <AnnotationSidebar
                        {annotations}
                        {annotationValue}
                        onEditValue={(value: AnnotationValue, valueMode: VideoMode) => {
                            annotationValue = value
                            mode = valueMode
                            if (selectedAnnotation) {
                                updateAnnotationValue(selectedAnnotation, value)
                            }
                        }}
                        onSelectAnnotation={selectAnnotation}
                        toolinfo={videoActivityContext.tools}
                        {mode}/>
                <SidebarInset>
                    <SvgOverlay
                        {annotations}
                        selected={selectedAnnotation}
                        {mode}
                        frame={current_frame}
                        onSelectAnnotation={selectAnnotation}
                        onSelection={onShapeSelection}
                        target_container={
                            player_container // ... context ?
                        }
                        >
                        <Video
                            bind:this={player}
                            bind:element={player_container}
                            onFramesChange={(current, total) => {
                                current_frame = current
                                total_frames = total
                            }}
                            onVolumeChange={(v) => volume = v}
                            src={videoActivityContext.medias['main'].url}
                        />
                    </SvgOverlay>
                </SidebarInset>
                <ToolSidebar
                    {mode}
                    onSelectMode={(selection) => {
                        selectedAnnotation = undefined
                        mode = selection
                    }}
                    />
            </ResizablePane>

            <ResizableHandle withHandle />

            <ResizablePane defaultSize={40} minSize={10}>
                <Button onclick={() => showErrorToast({})}>Toast</Button>
                <Controls
                    onNextFrame={() => player.nextFrame()}
                    onTogglePlay={() => player.togglePlay()}
                    onPreviousFrame={() => player.previousFrame()}
                    onToggleMute={() => player.toggleMute()}
                    current_frame={current_frame}
                    total_frames={total_frames}
                    volume={volume}
                    onSetVolume={(v:number) => volume = player.setVolume(v) || 0}
                    onSeekFrame={(f:number) => player.seekToFrame(f)}
                    annotations={annotations}
                    {selectedAnnotation}
                    onSelectAnnotation={selectAnnotation}
                />
            </ResizablePane>
        </ResizablePaneGroup>
    </SidebarProvider>
</div>
