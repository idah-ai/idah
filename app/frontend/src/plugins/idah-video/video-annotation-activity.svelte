<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { toast } from "svelte-sonner";
  import { uuidv7 } from "uuidv7";

  import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
  } from "$lib/components/ui/command";
  import CommandManager from "@/command/CommandManager";
  import Button from "@/components/ui/button/button.svelte";
  import { Popover, PopoverContent } from "@/components/ui/popover";
  import { ScrollArea } from "@/components/ui/scroll-area";
  import SidebarInset from "@/components/ui/sidebar/sidebar-inset.svelte";
  import SidebarProvider from "@/components/ui/sidebar/sidebar-provider.svelte";

  import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "@/components/ui/resizable";
  import { AnnotationRecord } from "@/data/model/dataset/annotations/record";

  import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { IActivityContext } from "@/plugin/interface/Activity";

  import { ShortcutManager } from "@/shortcut/ShortcutManager";
  import AnnotationFooter from "./layout/footer/AnnotationFooter.svelte";
  import AnnotationFooterToolbar from "./layout/footer/AnnotationFooterToolbar.svelte";
  import AnnotationHeaderBar from "./layout/header/AnnotationHeaderBar.svelte";
  import AnnotationSidebar from "./layout/sidebar/annotation-sidebar.svelte";
  import NoteSidebar from "./layout/sidebar/notes/note-sidebar.svelte";
  import SvgOverlay from "./video-annotation-activity/svg-overlay.svelte";
  import TimelineTable from "./video-annotation-activity/timeline-table/timeline-table.svelte";
  import Video from "./video-annotation-activity/video.svelte";
  import VideoController from "./video-annotation-activity/VideoController.svelte";

  import { noteSidebarStore } from "./layout/sidebar/notes/note-sidebar-stores";
  import { boundingBoxes, idb_updated_at } from "./video-annotation-activity/idb_store.svelte";
  import { annotationsIndexedDB, AnnotationsIndexedDB } from "./video-annotation-activity/indexedDB";
  import { registerVisualModeShortcuts } from "./video-annotation-activity/shortcut";

  import type {
    Point,
    VideoAnnotation,
    VideoFrameSelection,
    VideoShape,
  } from "./video-annotation-activity/VideoAnnotationContext";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();

  // Contexts
  setContext("context", context);

  // Variables
  let player: Video | undefined = $state();
  let player_container: HTMLDivElement | undefined = $state();
  let currentFrame = $state(0);
  let totalFrames = $state(0);

  let mode: string = $state("visual");

  let selectedAnnotation: VideoAnnotation | undefined = $state();
  let annotationValue: AnnotationValue = $derived(selectedAnnotation?.value || {});

  let entry_id = $state(context.id);
  let url = $state(context.mediaUrl);

  let zoom = $state(100);
  let scale = $state(1);
  let timelineTable: TimelineTable;
  let videoController: VideoController;

  let annotationsIDB: AnnotationsIndexedDB | undefined = $state();

  let commandOpen = $state(false);

  registerVisualModeShortcuts({
    player: () => player,
    toggleCommandCB: () => {
      commandOpen = !commandOpen;
    },
    flush: () => context.annotations.flush(),
    switch_mode: (_mode: string) => {},
    zoom: { in: () => {}, out: () => {} },
  });

  window.onkeydown = (e) => {
    const current_mode = ShortcutManager.getCurrentMode();
    const keymap = ShortcutManager.keyMap[current_mode];

    if (!keymap) return console.error("no keymap found for", { current_mode });

    const modifier_keys = [
      e.altKey && "Alt",
      e.ctrlKey && "Control",
      e.metaKey && "Meta",
      e.shiftKey && "Shift",
    ].sort();

    const shortcut_keys = (
      ["Control", "Alt", "Shift", "Meta"].includes(e.key)
        ? [undefined]
        : e.code.startsWith("Key")
          ? [e.key.toLocaleUpperCase(), e.key.toLocaleLowerCase()]
          : [e.code]
    ).map((k) => [...modifier_keys, k].filter((k) => k).join("+"));

    for (let index = 0; index < shortcut_keys.length; index++) {
      let shortcut_key = shortcut_keys[index];

      let shortcut = keymap[shortcut_key];

      if (!shortcut) continue;

      e.preventDefault();
      shortcut.action();
      console.log({ shortcut_key, shortcut });
      break;
    }
  };

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
      fetchAnnotations(idb);
    }, console.error);

    function fetchAnnotations(db: AnnotationsIndexedDB, page = 1, itemsPerPage = 100): Promise<void> {
      return new Promise<void>((resolve, reject) => {
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

          console.debug("fetched", d);
          if (d.length) {
            console.debug("adding to db");
            db.addAnnotations(d).then(() => {
              $idb_updated_at = new Date();
              console.debug("added at", { $idb_updated_at });
              fetchAnnotations(db, page + 1).then(resolve, reject);
            });
          } else {
            resolve();
          }
        });
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
        selectedAnnotation = annotation;
        await annotationsIDB?.addAnnotations([annotation]);
        $idb_updated_at = new Date();

        let p = context.annotations.create(id, annotation.shape, annotation.value);

        p.then(async () => {
          let a = await annotationsIDB?.get("annotations", id);

          if (a && a.metadata.updatedAt.valueOf() == createdAt.valueOf()) {
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

        let _p = context.annotations.delete(id);
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

        p.then(() => ($idb_updated_at = new Date()));
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

        p.then(async () => {
          let annotation = await annotationsIDB?.get("annotations", id);

          if (annotation?.metadata.updatedAt.valueOf() == createdAt.valueOf()) {
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
    const cmd = {
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
        selectedAnnotation = undefined;
        selectedAnnotation = v;

        v.metadata.updatedAt = updatedAt;
        v.synced = false;

        await annotationsIDB?.addKeyFrame(v, selection);
        $idb_updated_at = new Date();

        let p = context.annotations.update({
          id: v.metadata.id,
          dimensions: v.shape,
          annotation: v.value,
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

        p.then(async () => {
          if (v.metadata.updatedAt == updatedAt) {
            v.synced = true;
            await annotationsIDB?.addAnnotations([v]);
            $idb_updated_at = new Date();
          }
        });
      },
      isCombinable: () => false,

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      combine: (_c: any) => cmd,
    };
    CommandManager.add(cmd);
  }

  async function deleteSelection(annotation_id: string, frame: number) {
    const annotation = await annotationsIDB?.get("annotations", annotation_id);

    if (!annotation) return toast.error("cannot remove selection, annotation not found");

    let index = annotation.shape.frames.findIndex((v) => v.frame == frame);
    if (index == -1) return toast.warning("No frame to remove");

    let selection = annotation.shape.frames[index];

    const cmd = {
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

        selectedAnnotation = undefined;
        selectedAnnotation = annotation;

        let p = context.annotations.update({
          id: annotation.metadata.id,
          dimensions: annotation.shape,
          annotation: annotation.value,
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

        p.then(async () => {
          if (annotation.metadata.updatedAt == updatedAt) {
            annotation.synced = true;
            await annotationsIDB?.addAnnotations([annotation]);
            $idb_updated_at = new Date();
          }
        });
      },
      isCombinable: () => false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      combine: (_c: any) => cmd,
    };

    CommandManager.add(cmd);
  }

  function onDeleteAnnotation(annotation: VideoAnnotation, frame?: number) {
    if (frame != undefined) deleteSelection(annotation.metadata.id, frame);
    else removeAnnotation(annotation.metadata.id);
  }

  let shapeSelectionArgs: [type: string, frame: number, _points: Point[], selectedId?: string] | undefined = $state();

  function onShapeSelection(type: string, frame: number, _points: Point[] = [], selectedId?: string) {
    let points = $state.snapshot(_points) as Point[];
    if (!selectedId) {
      let annotation_value_from = $state.snapshot(annotationValue) as AnnotationValue;

      // todo proper validation
      if (annotationValue.category) {
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
        shapeSelectionArgs = [type, frame, _points, selectedId];
        showPopOver = true;
      }
    } else {
      addSelection(selectedId, { frame, points });
    }
  }

  function updateAnnotationValue(annotation: VideoAnnotation, value: AnnotationValue) {
    const annotation_id = annotation.metadata.id;
    const value_from = annotation.value;
    const cmd = {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      combine: (_c: any) => cmd,
    };

    CommandManager.add(cmd);
  }

  function selectAnnotation(annotation?: VideoAnnotation) {
    /**
     * Create a new note feed with the selected annotation
     * If noteSidebarStore is open
     */
    if ($noteSidebarStore.open) {
      // context.notes.create({
      //   annotation_id: annotation?.metadata.id || null,
      //   anchor_type: "annotation",
      //   content_md: annotation?.metadata.id || "",
      //   position: {
      //     ...annotation?.shape,
      //   },
      // });
      // toast.success("Note added on selected annotation");
      // $noteSidebarStore.lastUpdated = new Date();
    } else {
      selectedAnnotation = annotation;
      mode = annotation?.shape.type || "visual";
    }
  }

  let overlay: SvgOverlay;

  let annotations_promise: Promise<VideoAnnotation[]> = $derived.by(() => {
    // $idb_updated_at;
    if (!annotationsIDB) return new Promise((_, ko) => ko("no database"));

    let p = annotationsIDB.getAllStore("annotations");

    p.then((anns) => ($boundingBoxes = anns));

    return p;
  });

  let showPopOver = $state(false);
  let videoResizedAt = $state(new Date());
</script>

<div class="flex h-screen w-full flex-col">
  {#key [ShortcutManager, ShortcutManager.currentMode, ShortcutManager.getCurrentMode()]}
    <CommandDialog bind:open={commandOpen} accesskey={ShortcutManager.getCurrentMode()}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading={`MODE: ${ShortcutManager.getCurrentMode()}`}>
          {#each Object.entries(ShortcutManager.keyMap[ShortcutManager.getCurrentMode()] || []) as [key, value] (key)}
            <CommandItem onclick={() => value.action()}>
              <span>{value.name} ({value.description})</span>
              <CommandShortcut>{key}</CommandShortcut>
            </CommandItem>
          {/each}
        </CommandGroup>
        <CommandSeparator />
      </CommandList>
    </CommandDialog>
  {/key}

  <AnnotationHeaderBar {context} {mode} onSelectMode={() => (selectedAnnotation = undefined)}></AnnotationHeaderBar>

  <Popover
    open={showPopOver}
    onOpenChange={(open: boolean) => {
      showPopOver = open;
    }}
  >
    <PopoverContent class="w-max">
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
        {onDeleteAnnotation}
        {context}
        {mode}
        selected_id={selectedAnnotation?.metadata.id}
      />
      <Button
        onclick={() => {
          showPopOver = false;
          annotationValue = {};
          selectAnnotation();
        }}>Cancel</Button
      >
      <Button
        onclick={() => {
          showPopOver = false;
          if (shapeSelectionArgs) onShapeSelection(...shapeSelectionArgs);
        }}
        disabled={!shapeSelectionArgs}>Confirm</Button
      >
    </PopoverContent>
  </Popover>

  <SidebarProvider class="min-h-0 w-full" style="height: calc(100% - 30px)" bind:open={$noteSidebarStore.open}>
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
              selectedAnnotation.value = value;
              updateAnnotationValue(selectedAnnotation, value);
            }
          }}
          onSelectAnnotation={selectAnnotation}
          {onDeleteAnnotation}
          {context}
          {mode}
          selected_id={selectedAnnotation?.metadata.id}
        />

        <SidebarInset class="flex-1">
          <SvgOverlay
            bind:this={overlay}
            {annotations_promise}
            selected={selectedAnnotation}
            {mode}
            frame={currentFrame}
            onSelectAnnotation={selectAnnotation}
            onSelection={onShapeSelection}
            target_container={player_container}
            {videoResizedAt}
          >
            <!-- container context ?-->
            <Video
              bind:this={player}
              bind:element={player_container}
              onResize={() => {
                videoResizedAt = new Date();
              }}
              onFramesChange={(current, total) => {
                currentFrame = current;
                totalFrames = total;
              }}
              onVolumeChange={() => {}}
            />
          </SvgOverlay>
        </SidebarInset>

        <NoteSidebar />
      </ResizablePane>

      <ResizableHandle withHandle></ResizableHandle>

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
              {annotations_promise}
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
