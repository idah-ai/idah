<script lang="ts">
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import { uuidv7 } from "uuidv7";
    import { Toaster } from "@/components/ui/sonner";

    import AnnotationHeaderBar from "@/components/app/annotation/layout/header/AnnotationHeaderBar.svelte";
    import AnnotationFooter from "@/components/app/annotation/layout/footer/AnnotationFooter.svelte";
    import AnnotationFooterToolbar from "@/components/app/annotation/layout/footer/AnnotationFooterToolbar.svelte";
    import AnnotationSidebar from "@/components/video-annotation-activity/annotation-sidebar.svelte";
    import CommandManager from "@/command/CommandManager";
    import { JsonRpcDatasource } from "./video-annotation-activity/jsonrpc";
    import SidebarProvider from "@/components/ui/sidebar/sidebar-provider.svelte";
    import SidebarInset from "@/components/ui/sidebar/sidebar-inset.svelte";
    import SvgOverlay from "@/components/video-annotation-activity/svg-overlay.svelte";
    import Video from "@/components/video-annotation-activity/video.svelte";
    import videoActivityContext from "@/components/video-annotation-activity/VideoActivityContext";
    import VideoController from "@/components/video-annotation-activity/VideoController.svelte";
    import {
        type Point,
        type VideoAnnotation,
        type VideoMode,
        type VideoShape,
        type VideoShapeType,
        type VideoFrameSelection,
    } from "@/components/video-annotation-activity/VideoAnnotationContext";

    import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "@/components/ui/resizable";
    import { annotationsBackendDataSource } from "@/data/model/dataset/annotationRecord";

    import type { AnnotationValue } from "@/context/AnnotationContext";
    import type { Command } from "@/command/Command";
    import { entriesBackendDataSource } from "@/data/model/dataset/entryRecord";
    import { sleep } from "@/utils/delayed";
    import { projectsBackendDataSource } from "@/data/model/dataset/projectRecord";
    import { datasetsBackendDataSource } from "@/data/model/dataset/datasetRecord";
    import { openIndexedDB } from "./video-annotation-activity/indexedDB";
    import TimelineTable from "./video-annotation-activity/timeline-table/timeline-table.svelte";
    import ScrollArea from "./ui/scroll-area/scroll-area.svelte";

    let player: Video|undefined = $state();
    let player_container: HTMLDivElement | undefined = $state(); // ...
    let volume: number = $state(0);
    let currentFrame = $state(0);
    let totalFrames = $state(0);

    let mode: VideoMode = $state("view");

    let selectedAnnotation: VideoAnnotation | undefined = $state();
    let annotationValue: AnnotationValue = $derived(selectedAnnotation?.value || {});

    let annotations: Array<VideoAnnotation> = $state([]);

    let entry_id = $state()
    let url = $state("")
    let idb:IDBDatabase|undefined = $state()

    let zoom = $state(100)
    let scale = $state(1)
    let timelineTable:TimelineTable
    let videoController: VideoController
    const annotations_rpc = new JsonRpcDatasource(
    "https://idah.localhost:8443/api/v1/dataset/annotations/_rpc",
        50
    );

   onMount(async () => {
        // for now
        $effect(() => {
            if (url && player && url != player?.source()){
                player?.source(url);//...
            }
        })

        projectsBackendDataSource.list().then((projects) => {
            console.log({projects})

            datasetsBackendDataSource.list().then((datasets) => {
                console.log({datasets})

                entriesBackendDataSource.list().then((entries) => {
                    console.log({entries})
                    entry_id = entries.data[0].id
                    url = [
                        'https://idah.localhost:8443/api/v1/media/medias/files',
                        entries.data[0].attributes().resource,
                        'master.m3u8'
                    ].join('/')

                    openIndexedDB('dataset').then((db) => {
                        idb = db
                        fetchAnnotations()
                    }, console.error)
                })
            })
        })

        function fetchAnnotations(page = 1, itemsPerPage = 100){
            annotationsBackendDataSource.list({
                filters:{entry_id: entry_id}, // >?

                pagination:{page, itemsPerPage}
            }).then((r) => {
                r.data.map((a) => {
                    return {
                        shape: a.dimensions as VideoShape,
                        value: a.annotation,
                        metadata: {
                            id: a.id,
                            updatedAt: a.updated_at,
                            createdAt: a.created_at,
                        }, synced: true
                    }
                }).forEach((i) => {
                    // test
                    // if created locally during loading ?
                    if (annotations.find(a => a.metadata.id == i.metadata.id)){
                        return
                    }
                    let atransaction = idb?.transaction("annotations", "readwrite")
                    let astore = atransaction?.objectStore('annotations')
                    astore?.add(i, i.metadata.id);
                    i.shape.frames.forEach((k) => {
                        let ktransaction = idb?.transaction("keyframes", "readwrite")
                        let kstore = ktransaction?.objectStore('keyframes')
                        kstore?.add(k, [i.metadata.id, k.frame]);
                    })

                    annotations.push(i)
                });
                if (r.data.length) fetchAnnotations(page + 1)
            });
        }
    });

    function addAnnotation(shape: VideoShape, value: AnnotationValue = {}) {
        const id = uuidv7();

        const cmd = {
            name: "new annotation",
            apply() {
                const createdAt = new Date();
                let annotation = {
                    shape,
                    value,
                    metadata: {
                        // \_o_/
                        id,
                        createdAt,
                        updatedAt: createdAt,
                    },
                    synced: false
                };
                annotations.push({ ...annotation, synced: false });

                let p = annotations_rpc.call(
                    {
                        method: "create",
                        params: {
                            id: annotation.metadata.id,
                            entry_id,
                            dimensions: annotation.shape,
                            annotation: annotation.value,
                        }
                    }
                );

                toast.promise(p, {
                    loading: "synchro create annotation",
                    success: "synchro create annotation OK",
                    error: "synchro create annotation KO",
                });
                p.then(() => {
                    let a = annotations.find((v) => v.metadata.id == id);

                    if (a && a.metadata.updatedAt == createdAt)
                        a.synced = true;
                })
            },
            undo() {
                if (id == selectedAnnotation?.metadata.id) selectedAnnotation = undefined;
                annotations = annotations.filter((v) => {
                    return v.metadata.id != id;
                });
                let p = annotations_rpc.call(
                    { method: 'delete', params: {id} }
                )

                toast.promise(p, {
                    loading: "synchro undo create annotation",
                    success: "synchro undo create annotation OK",
                    error: "synchro undo create annotation KO",
                });

            },
            isCombinable: () => false,
            combine: () => cmd,
        };
        CommandManager.add(cmd);
    }

    function removeAnnotation(id: string) {
        let annotation = annotations.find((v) => v.metadata.id == id);

        if (!annotation) return console.warn({ removeAnnotation, annotation });

        const cmd = {
            name: "remove annotation",
            apply() {
                if (id == selectedAnnotation?.metadata.id) selectedAnnotation = undefined;
                annotations = annotations.filter((v) => {
                    return v.metadata.id != id;
                });
                let p = annotations_rpc.call(
                    { method: 'delete', params: {id} }
                )

                toast.promise(p, {
                    loading: "synchro delete annotation",
                    success: "synchro delete annotation OK",
                    error: "synchro delete annotation KO",
                });
            },
            undo() {
                const createdAt = new Date();
                annotations = [
                    ...annotations.filter((v) => {
                        return v.metadata.id != id;
                    }),
                    {
                        ...annotation,
                        metadata: {
                            ...annotation.metadata,
                            createdAt,
                            updatedAt: createdAt,
                        },
                        synced: false,
                    },
                ];

                let p = annotations_rpc.call(
                    {
                        method: "create",
                        params: {
                            id: annotation.metadata.id,
                            entry_id,
                            dimensions: annotation.shape,
                            annotation: annotation.value,
                        }
                    }
                );

                toast.promise(p, {
                    loading: "synchro undo delete annotation",
                    success: "synchro undo delete annotation OK",
                    error: "synchro undo delete annotation KO",
                });
                p.then(() => {
                    if (annotation.metadata.updatedAt == createdAt)
                        annotation.synced = true;
                })

            },
            isCombinable: () => false,
            combine: () => cmd,
        };
        CommandManager.add(cmd);
    }

    function getAnnotationInfo(id: string) {
        return annotations.find((v) => v.metadata.id == id);
    }

    function addSelection(id: string, selection: VideoFrameSelection) {
        const v = getAnnotationInfo(id);

        if (!v) return console.warn({ addSelection, annotation: v });

        selection = $state.snapshot(selection) as VideoFrameSelection;

        const from = $state(v.shape.frames.find((f) => f.frame == selection.frame));
        const start = v.shape.start;
        const end = v.shape.end;
        const cmd: Command = {
            name: "add bounding box selection",
            apply() {
                const v = getAnnotationInfo(id);

                if (!v) return toast.error("bounding box not found");

                const updatedAt = new Date();
                v.shape = {
                    ...v.shape,
                    start: v.shape.start <= selection.frame ? v.shape.start : selection.frame,
                    end: v.shape.end >= selection.frame ? v.shape.end : selection.frame,
                    frames: [...v.shape.frames.filter((f) => f.frame != selection.frame), selection],
                };
                v.metadata.updatedAt = updatedAt;
                v.synced = false;

                let p = annotations_rpc.call(
                    {
                        method: 'update',
                        params: {
                            id: v.metadata.id,
                            entry_id,
                            dimensions: v.shape,
                            annotation: v.value,
                        }
                    }
                )

                toast.promise(p, {
                    loading: "synchro add bounding box",
                    success: "synchro add bounding box OK",
                    error: "synchro add bounding box KO",
                });
                p.then(() => {
                    if (v.metadata.updatedAt == updatedAt)
                        v.synced = true;
                })

            },
            undo() {
                const v = getAnnotationInfo(id);

                if (!v) return toast.error("bounding box not found");

                const updatedAt = new Date();
                v.shape = {
                    ...v.shape,
                    start,
                    end,
                    frames: from
                        ? [...v.shape.frames.filter((f) => f.frame != selection.frame), from]
                        : v.shape.frames.filter((f) => f.frame != selection.frame),
                };
                v.metadata.updatedAt = updatedAt;
                v.synced = false;

                let p = annotations_rpc.call(
                    {
                        method: 'update',
                        params: {
                            id: v.metadata.id,
                            entry_id,
                            dimensions: v.shape,
                            annotation: v.value,
                        }
                    }
                )

                toast.promise(p, {
                    loading: "synchro undo add bounding box",
                    success: "synchro undo add bounding box OK",
                    error: "synchro undo add bounding box KO",
                });
                p.then(() => {
                    if (v.metadata.updatedAt == updatedAt)
                        v.synced = true;
                })

            },
            isCombinable: () => false,

            combine: (c) => cmd,
        };
        CommandManager.add(cmd);
    }

    function deleteSelection(annotation_id: string, frame: number) {
        let annotation = getAnnotationInfo(annotation_id);

        if (!annotation) return toast.error("cannot remove selection, annotation not found");

        let index = annotation.shape.frames.findIndex((v) => v.frame == frame);
        if (index == -1) return toast.warning("No frame to remove");

        let selection = annotation.shape.frames[index];

        const cmd: Command = {
            name: "delete bounding box keyframe",
            apply() {
                const updatedAt = new Date();
                let annotation = getAnnotationInfo(annotation_id);

                if (!annotation) return toast.error("cannot remove keyframe, annotation not found");

                let index = annotation.shape.frames.findIndex((v) => v.frame == frame);
                if (index == -1) return toast.warning("No frame to remove");

                let newframes = annotation.shape.frames.filter((v) => v.frame != frame);
                annotation.shape = {
                    start: newframes.reduce((acc, v) => (v.frame <= acc || acc == -1 ? v.frame : acc), -1),
                    end: newframes.reduce((acc, v) => (v.frame >= acc || acc == -1 ? v.frame : acc), -1),
                    type: annotation.shape.type,
                    frames: newframes,
                };
                annotation.metadata.updatedAt = updatedAt;


                let p = annotations_rpc.call(
                    {
                        method: 'update',
                        params: {
                            id: annotation.metadata.id,
                            entry_id,
                            dimensions: annotation.shape,
                            annotation: annotation.value,
                        }
                    }
                )

                toast.promise(p, {
                    loading: "synchro delete selection",
                    success: "synchro delete selection OK",
                    error: "synchro delete selection KO",
                });
                p.then(() => {
                    if (annotation.metadata.updatedAt == updatedAt)
                        annotation.synced = true;
                })
            },
            undo() {
                const updatedAt = new Date();
                let annotation = getAnnotationInfo(annotation_id);

                if (!annotation) return toast.error("cannot undo remove selection, annotation not found");

                let newframes = [...annotation.shape.frames.filter((v) => v.frame != frame), selection];
                annotation.shape = {
                    start: newframes.reduce((acc, v) => (v.frame <= acc || acc == -1 ? v.frame : acc), -1),
                    end: newframes.reduce((acc, v) => (v.frame >= acc || acc == -1 ? v.frame : acc), -1),
                    type: annotation.shape.type,
                    frames: newframes,
                };
                annotation.metadata.updatedAt = updatedAt;
                annotation.synced = false;


                let p = annotations_rpc.call(
                    {
                        method: 'update',
                        params: {
                            id: annotation.metadata.id,
                            entry_id,
                            dimensions: annotation.shape,
                            annotation: annotation.value,
                        }
                    }
                )

                toast.promise(p, {
                    loading: "synchro undo delete selection",
                    success: "synchro undo delete selection OK",
                    error: "synchro undo delete selection KO",
                });

                p.then(() => {
                    if (annotation.metadata.updatedAt == updatedAt)
                        annotation.synced = true;
                })

            },
            isCombinable: () => false,
            combine: (c) => cmd,
        };

        CommandManager.add(cmd);
    }

    function onDeleteAnnotation(annotation: VideoAnnotation, frame?: number) {
        if (frame != undefined) deleteSelection(annotation.metadata.id, frame);
        else removeAnnotation(annotation.metadata.id);
    }

    function onShapeSelection(type: VideoShapeType, frame: number, points: Point[] = [], selectedId?: string) {
        if (!selectedId) {
            let annotation_value_from = $state.snapshot(annotationValue) as AnnotationValue;
            addAnnotation(
                {
                    type,
                    start: frame,
                    end: frame,

                    frames: [{ frame, points }],
                },
                annotation_value_from,
            );
        } else {
            addSelection(selectedId, { frame, points });
        }
    }

    function updateAnnotationValue(annotation: VideoAnnotation, value: AnnotationValue) {
        const annotation_id = annotation.metadata.id;
        const value_from = annotation.value;
        const cmd: Command = {
            name: "update annotation value",
            apply() {
                const annotation = getAnnotationInfo(annotation_id);
                const updatedAt = new Date();
                if (annotation) {
                    annotation.value = value;
                    annotation.metadata.updatedAt = updatedAt;
                    annotation.synced = false;
                    let p = annotations_rpc.call({
                        method: 'update',
                        params: {
                            id: annotation.metadata.id,
                            entry_id,
                            dimensions: annotation.shape,
                            annotation: value,
                        }
                    })
                    toast.promise(p, {
                        loading: "synchro update annotation value",
                        success: "synchro update annotation value OK",
                        error: "synchro update annotation value KO",
                    });
                    p.then(() => {
                        if (annotation.metadata.updatedAt == updatedAt)
                            annotation.synced = true;
                    })

                }
            },
            undo() {
                const annotation = getAnnotationInfo(annotation_id);
                if (annotation) {
                    const updatedAt = new Date();
                    annotation.value = value_from;
                    annotation.metadata.updatedAt = updatedAt;
                    annotation.synced = false;
                    let p = annotations_rpc.call(
                        {
                            method: 'update',
                            params: {
                                id: annotation.metadata.id,
                                entry_id,
                                dimensions: annotation.shape,
                                annotation: value_from,
                                type: annotation.shape.type,
                            }
                        }
                    )

                    toast.promise(p, {
                        loading: "synchro undo update annotation value",
                        success: "synchro undo update annotation value OK",
                        error: "synchro undo update annotation value KO",
                    });

                    p.then(() => {
                        if (annotation.metadata.updatedAt == updatedAt)
                            annotation.synced = true;
                    })
                }
            },
            isCombinable: () => false,
            combine: (c) => cmd,
        };

        CommandManager.add(cmd);
    }

    function selectAnnotation(annotation?: VideoAnnotation) {
        selectedAnnotation = annotation;
        mode = annotation?.shape.type || "view";
    }
</script>

<div class="flex h-screen w-full flex-col">
    <AnnotationHeaderBar
        context={videoActivityContext}
        bind:mode
        onSelectMode={() => {
            selectedAnnotation = undefined;
        }}
    />

    <Toaster position="bottom-right" />
    <SidebarProvider class="min-h-0 w-full" style={"height:calc(100% - 30px)"}>
        <ResizablePaneGroup direction="vertical">
            <ResizablePane class="flex h-full" defaultSize={60} minSize={10}>
                <AnnotationSidebar
                    {annotations}
                    {annotationValue}
                    {currentFrame}
                    onEditValue={(value: AnnotationValue, valueMode: VideoMode) => {
                        annotationValue = value;
                        mode = valueMode;
                        if (selectedAnnotation) {
                            updateAnnotationValue(selectedAnnotation, value);
                        }
                    }}
                    onSelectAnnotation={selectAnnotation}
                    toolinfo={videoActivityContext.tools}
                    {mode}
                />
                <SidebarInset>
                    <SvgOverlay
                        {annotations}
                        selected={selectedAnnotation}
                        {mode}
                        frame={currentFrame}
                        onSelectAnnotation={selectAnnotation}
                        onSelection={onShapeSelection}
                        target_container={player_container}
                    > <!-- container context ?-->
                        <Video
                            bind:this={player}
                            bind:element={player_container}
                            onFramesChange={(current, total) => {
                                currentFrame = current;
                                totalFrames = total;
                            }}
                            onVolumeChange={(v) => (volume = v)}
                        />
                    </SvgOverlay>
                </SidebarInset>
            </ResizablePane>

            <ResizableHandle withHandle />

            <ResizablePane defaultSize={40} minSize={10}>
                <AnnotationFooter>
                    <AnnotationFooterToolbar>
                        <VideoController
                            bind:this={videoController}
                            {zoom}
                            {scale}
                            {currentFrame}
                            {totalFrames}
                            bind:video={player}
                            onZoomChange={(z) => timelineTable.setZoom(z)}
                            onScaleChange={(s) => timelineTable.setScale(s)}
                        />
                    </AnnotationFooterToolbar>

                    <ScrollArea class="h-[calc(100%-3.4em)]">
                        <TimelineTable
                            bind:this={timelineTable}
                            {scale}
                            {zoom}
                            {currentFrame}
                            {totalFrames}
                            {annotations}
                            {selectedAnnotation}
                            onSeekFrame={(frame) => player?.seekToFrame(frame)}
                            {onDeleteAnnotation}
                            onSelectAnnotation={selectAnnotation}
                            onScaleChange={(s) => {
                                scale = s
                            }}
                            onZoomChange={(z) => {
                                zoom = z
                            }}
                        />
                    </ScrollArea>
                </AnnotationFooter>
            </ResizablePane>
        </ResizablePaneGroup>
    </SidebarProvider>
</div>
