<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { uuidv7 } from "uuidv7";
  import { Toaster } from "@/components/ui/sonner";

  import CommandManager from "@/command/CommandManager";
  import SidebarProvider from "@/components/ui/sidebar/sidebar-provider.svelte";
  import SidebarInset from "@/components/ui/sidebar/sidebar-inset.svelte";

  import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "@/components/ui/resizable";
  import { AnnotationRecord, annotationsBackendDataSource } from "@/data/model/dataset/annotations/record";

  import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { Command } from "@/command/Command";
  import { annotationsIndexedDB, AnnotationsIndexedDB } from "./video-annotation-activity/indexedDB";
  import TimelineTable from "./video-annotation-activity/timeline-table/timeline-table.svelte";
  import type { IActivityContext, IAnnotation } from "@/plugin/interface/Activity";
  import Video from "./video-annotation-activity/video.svelte";
  import type {
    Point,
    VideoAnnotation,
    VideoFrameSelection,
    VideoMode,
    VideoShape,
    VideoShapeType,
  } from "./video-annotation-activity/VideoAnnotationContext";
  import VideoController from "./video-annotation-activity/VideoController.svelte";
  import AnnotationSidebar from "./video-annotation-activity/annotation-sidebar.svelte";
  import SvgOverlay from "./video-annotation-activity/svg-overlay.svelte";
  import { ScrollArea } from "@/components/ui/scroll-area";
  import AnnotationHeaderBar from "./layout/header/AnnotationHeaderBar.svelte";
  import AnnotationFooter from "./layout/footer/AnnotationFooter.svelte";
  import AnnotationFooterToolbar from "./layout/footer/AnnotationFooterToolbar.svelte";
  import { boundingBoxes, idb_updated_at } from "./video-annotation-activity/idb_store.svelte";
  let { context }: { context: IActivityContext } = $props();

  let player: Video | undefined = $state();
  let player_container: HTMLDivElement | undefined = $state(); // ...
  let volume: number = $state(0);
  let currentFrame = $state(0);
  let totalFrames = $state(0);

  let mode: string = $state("view");

  let selectedAnnotation: VideoAnnotation | undefined = $state();
  let annotationValue: AnnotationValue = $derived(selectedAnnotation?.value || {});

  let entry_id = $state(context.id);
  let url = $state(context.mediaUrl);

  let zoom = $state(100);
  let scale = $state(1);
  let timelineTable: TimelineTable;
  let videoController: VideoController;

  let annotationsIDB: AnnotationsIndexedDB | undefined = $state();

  onMount(async () => {
    $boundingBoxes = [];

    // for now
    $effect(() => {
      if (url && player && url != player?.source()) {
        player?.source(url); //...
      }
    });

    annotationsIndexedDB(["idah-video", "entry", entry_id].join(":")).then((idb) => {
      annotationsIDB = idb;
      $idb_updated_at = new Date();

      fetchAnnotations(idb);
    }, console.error);

    function fetchAnnotations(db: AnnotationsIndexedDB, page = 1, itemsPerPage = 100) {
      context.annotations.list({ entry_id: entry_id }, { page, itemsPerPage }).then((r) => {
        let d = (r as AnnotationRecord[]).map((a) => {
          return {
            shape: {
              ...(a.dimensions as VideoShape),
              range: [a.dimensions.start, a.dimensions.end],
            },
            value: {
              ...a.annotation,
              category: a.annotation.category || "null", //........
            },
            metadata: {
              id: a.id,
              updatedAt: a.updated_at,
              createdAt: a.created_at,
            },
            synced: true,
          };
        });

        if (d.length) {
          db.addAnnotations(d).then(() => {
            $idb_updated_at = new Date();
            fetchAnnotations(db, page + 1);
          });
        }
      });
    }
  });

  function addAnnotation(shape: VideoShape, value: AnnotationValue = {}) {
    const id = uuidv7();
    const cmd = {
      name: "new annotation",
      async apply() {
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
          synced: false,
        };

        await annotationsIDB?.addAnnotations([annotation]);
        $idb_updated_at = new Date();

        let p = context.annotations.create(id, annotation.shape, annotation.value);

        toast.promise(p, {
          loading: "synchro create annotation",
          success: "synchro create annotation OK",
          error: "synchro create annotation KO",
        });
        p.then(async () => {
          let a = await annotationsIDB?.get("annotations", id);

          if (a && a.metadata.updatedAt == createdAt) {
            a.synced = true;
            await annotationsIDB?.addAnnotations([a]);
            $idb_updated_at = new Date();
          }
        });
      },
      async undo() {
        if (id == selectedAnnotation?.metadata.id) selectedAnnotation = undefined;

        await annotationsIDB?.deleteAnnotation(id);
        $idb_updated_at = new Date();

        let p = context.annotations.delete(id);

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

  async function removeAnnotation(id: string) {
    let annotation = await annotationsIDB?.get("annotations", id);

    if (!annotation) return console.warn({ removeAnnotation, annotation });

    const cmd = {
      name: "remove annotation",
      async apply() {
        if (id == selectedAnnotation?.metadata.id) selectedAnnotation = undefined;

        await annotationsIDB?.deleteAnnotation(id);
        $idb_updated_at = new Date();

        let p = context.annotations.delete(id);

        toast.promise(p, {
          loading: "synchro delete annotation",
          success: "synchro delete annotation OK",
          error: "synchro delete annotation KO",
        });
      },
      async undo() {
        const createdAt = new Date();
        let a = {
          ...annotation,
          metadata: {
            ...annotation.metadata,
            createdAt,
            updatedAt: createdAt,
          },
          synced: false,
        };

        await annotationsIDB?.addAnnotations([a]);
        $idb_updated_at = new Date();

        let p = context.annotations.create(id, annotation.shape, annotation.value);

        toast.promise(p, {
          loading: "synchro undo delete annotation",
          success: "synchro undo delete annotation OK",
          error: "synchro undo delete annotation KO",
        });
        p.then(async () => {
          if (annotation.metadata.updatedAt == createdAt) {
            annotation.synced = true;
            await annotationsIDB?.addAnnotations([annotation]);
            $idb_updated_at = new Date();
          }
        });
      },
      isCombinable: () => false,
      combine: () => cmd,
    };
    CommandManager.add(cmd);
  }

  async function addSelection(id: string, selection: VideoFrameSelection) {
    const v = await annotationsIDB?.get("annotations", id);

    if (!v) return console.warn({ addSelection, annotation: v });

    selection = $state.snapshot(selection) as VideoFrameSelection;

    const from = $state(v.shape.frames.find((f) => f.frame == selection.frame));
    const start = v.shape.start;
    const end = v.shape.end;
    const cmd: Command = {
      name: "add bounding box selection",
      async apply() {
        const v = await annotationsIDB?.get("annotations", id);

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

        await annotationsIDB?.addKeyFrame(v, selection);
        $idb_updated_at = new Date();

        let p = context.annotations.update({
          id: v.metadata.id,
          dimensions: v.shape,
          annotation: v.value,
        });

        toast.promise(p, {
          loading: "synchro add bounding box",
          success: "synchro add bounding box OK",
          error: "synchro add bounding box KO",
        });
        p.then(async () => {
          if (v.metadata.updatedAt == updatedAt) {
            v.synced = true;
            await annotationsIDB?.addAnnotations([v]);
            $idb_updated_at = new Date();
          }
        });
      },
      async undo() {
        const v = await annotationsIDB?.get("annotations", id);

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

        await annotationsIDB?.deleteKeyFrame(v, selection.frame);
        $idb_updated_at = new Date();

        let p = context.annotations.update({
          id: v.metadata.id,
          dimensions: v.shape,
          annotation: v.value,
        });

        toast.promise(p, {
          loading: "synchro undo add bounding box",
          success: "synchro undo add bounding box OK",
          error: "synchro undo add bounding box KO",
        });
        p.then(async () => {
          if (v.metadata.updatedAt == updatedAt) {
            v.synced = true;
            await annotationsIDB?.addAnnotations([v]);
            $idb_updated_at = new Date();
          }
        });
      },
      isCombinable: () => false,

      combine: (c) => cmd,
    };
    CommandManager.add(cmd);
  }

  async function deleteSelection(annotation_id: string, frame: number) {
    const annotation = await annotationsIDB?.get("annotations", annotation_id);

    if (!annotation) return toast.error("cannot remove selection, annotation not found");

    let index = annotation.shape.frames.findIndex((v) => v.frame == frame);
    if (index == -1) return toast.warning("No frame to remove");

    let selection = annotation.shape.frames[index];

    const cmd: Command = {
      name: "delete bounding box keyframe",
      async apply() {
        const updatedAt = new Date();
        const annotation = await annotationsIDB?.get("annotations", annotation_id);

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
        await annotationsIDB?.deleteKeyFrame(annotation, frame);
        $idb_updated_at = new Date();

        let p = context.annotations.update({
          id: annotation.metadata.id,
          dimensions: annotation.shape,
          annotation: annotation.value,
        });

        toast.promise(p, {
          loading: "synchro delete selection",
          success: "synchro delete selection OK",
          error: "synchro delete selection KO",
        });

        p.then(async () => {
          if (annotation.metadata.updatedAt == updatedAt) {
            annotation.synced = true;
            await annotationsIDB?.addAnnotations([annotation]);
            $idb_updated_at = new Date();
          }
        });
      },
      async undo() {
        const updatedAt = new Date();
        let annotation = await annotationsIDB?.get("annotations", annotation_id);

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
        await annotationsIDB?.addKeyFrame(annotation, selection);
        $idb_updated_at = new Date();

        let p = context.annotations.update({
          id: annotation.metadata.id,
          dimensions: annotation.shape,
          annotation: annotation.value,
        });

        toast.promise(p, {
          loading: "synchro undo delete selection",
          success: "synchro undo delete selection OK",
          error: "synchro undo delete selection KO",
        });

        p.then(async () => {
          if (annotation.metadata.updatedAt == updatedAt) {
            annotation.synced = true;
            await annotationsIDB?.addAnnotations([annotation]);
            $idb_updated_at = new Date();
          }
        });
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

  function onShapeSelection(type: string, frame: number, _points: Point[] = [], selectedId?: string) {
    let points = $state.snapshot(_points) as Point[];
    if (!selectedId) {
      let annotation_value_from = $state.snapshot(annotationValue) as AnnotationValue;
      console.log(annotation_value_from);

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
      async apply() {
        const annotation = await annotationsIDB?.get("annotations", annotation_id);
        const updatedAt = new Date();
        if (annotation) {
          annotation.value = value;
          annotation.metadata.updatedAt = updatedAt;
          annotation.synced = false;

          await annotationsIDB?.addAnnotations([annotation]);
          $idb_updated_at = new Date();

          let p = context.annotations.update({
            id: annotation.metadata.id,
            dimensions: annotation.shape,
            annotation: value,
          });

          toast.promise(p, {
            loading: "synchro update annotation value",
            success: "synchro update annotation value OK",
            error: "synchro update annotation value KO",
          });
          p.then(async () => {
            if (annotation.metadata.updatedAt == updatedAt) {
              annotation.synced = true;
              await annotationsIDB?.addAnnotations([annotation]);
              $idb_updated_at = new Date();
            }
          });
        }
      },
      async undo() {
        const annotation = await annotationsIDB?.get("annotations", annotation_id);
        if (annotation) {
          const updatedAt = new Date();
          annotation.value = value_from;
          annotation.metadata.updatedAt = updatedAt;
          annotation.synced = false;

          let p = context.annotations.update({
            id: annotation.metadata.id,
            dimensions: annotation.shape,
            annotation: value_from,
          });

          toast.promise(p, {
            loading: "synchro undo update annotation value",
            success: "synchro undo update annotation value OK",
            error: "synchro undo update annotation value KO",
          });

          p.then(async () => {
            if (annotation.metadata.updatedAt == updatedAt) {
              annotation.synced = true;
              await annotationsIDB?.addAnnotations([annotation]);
              $idb_updated_at = new Date();
            }
          });
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
    {context}
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
          db={annotationsIDB}
          {annotationValue}
          {currentFrame}
          onEditValue={(value: AnnotationValue, valueMode: string) => {
            annotationValue = value;
            mode = valueMode;
            if (selectedAnnotation) {
              updateAnnotationValue(selectedAnnotation, value);
            }
          }}
          onSelectAnnotation={selectAnnotation}
          {context}
          {mode}
        />
        <SidebarInset>
          <SvgOverlay
            db={annotationsIDB}
            selected={selectedAnnotation}
            {mode}
            frame={currentFrame}
            onSelectAnnotation={selectAnnotation}
            onSelection={onShapeSelection}
            target_container={player_container}
          >
            <!-- container context ?-->
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
              db={annotationsIDB}
              {scale}
              {zoom}
              {currentFrame}
              {totalFrames}
              {selectedAnnotation}
              onSeekFrame={(frame) => player?.seekToFrame(frame)}
              {onDeleteAnnotation}
              onSelectAnnotation={selectAnnotation}
              onScaleChange={(s) => {
                scale = s;
              }}
              onZoomChange={(z) => {
                zoom = z;
              }}
            />
          </ScrollArea>
        </AnnotationFooter>
      </ResizablePane>
    </ResizablePaneGroup>
  </SidebarProvider>
</div>
