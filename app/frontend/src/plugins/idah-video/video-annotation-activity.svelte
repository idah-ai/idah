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
  import Button from "@/components/ui/button/button.svelte";
  import { Popover, PopoverContent } from "@/components/ui/popover";
  import SidebarInset from "@/components/ui/sidebar/sidebar-inset.svelte";

  import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "@/components/ui/resizable";
  import { ScrollArea } from "@/components/ui/scroll-area";
  import type { AnnotationMetadata, AnnotationObj } from "@/context/AnnotationContext";
  import { AnnotationRecord } from "@/data/model/dataset/annotations/record";
  import { ShortcutManager } from "@/shortcut/ShortcutManager";
  import AnnotationFooter from "./layout/footer/AnnotationFooter.svelte";
  import AnnotationFooterToolbar from "./layout/footer/AnnotationFooterToolbar.svelte";
  import AnnotationSidebar from "./layout/sidebar/annotation-sidebar.svelte";
  import { DEFAULT_MODE, ENTRY_ROOT, IDAH_NOTE, IDAH_VIDEO_BOUNDING_BOX } from "./type";
  import { requiredFullfilled } from "./video-annotation-activity/categoryProperties";
  import { boundingBoxes, entryRoot, idb_updated_at } from "./video-annotation-activity/idb_store.svelte";
  import { annotationsIndexedDB, AnnotationsIndexedDB } from "./video-annotation-activity/indexedDB";
  import SvgOverlay, { type OnAddNewNoteParams } from "./video-annotation-activity/svg-overlay.svelte";
  import TimelineTable from "./video-annotation-activity/timeline-table/timeline-table.svelte";
  import Video from "./video-annotation-activity/video.svelte";

  import PopoverTrigger from "@/components/ui/popover/popover-trigger.svelte";
  import { SidebarProvider } from "@/components/ui/sidebar";
  import type { AnnotationShape, AnnotationValue } from "@/context/AnnotationContext";
  import type { IActivityContext } from "@/plugin/interface/Activity";
  import PropertiesSidebar from "./layout/sidebar/properties-sidebar.svelte";
  import CategoryProperties from "./video-annotation-activity/categoryProperties/categoryProperties.svelte";
  import type { Point, VideoFrameSelection, VideoShape } from "./video-annotation-activity/VideoAnnotationContext";
  import VideoController from "./video-annotation-activity/VideoController.svelte";
  import { registerVisualModeShortcuts } from "./video-annotation-activity/shortcut";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();

  // Contexts
  setContext("context", context);

  // Lifecycles
  $effect(() => console.debug({ $idb_updated_at }));
  $effect(() => console.debug({ $boundingBoxes }));
  $effect(() => console.debug({ $entryRoot }));

  // Variables
  let player: Video | undefined = $state();
  let player_container: HTMLDivElement | undefined = $state();
  let currentFrame = $state(0);
  let totalFrames = $state(0);

  let mode: string = $state("visual");
  let annotationSidebarWidthRem = $state<number>(15);

  let selectedAnnotation: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata> | undefined = $state();
  let annotationValue: AnnotationValue = $derived(selectedAnnotation?.value || {});

  let entry_id = $state(context.id);
  let url = $state(context.mediaUrl);

  let zoom = $state(85);
  let scale = $state(1);
  let timelineTable: TimelineTable;
  let videoController: VideoController;

  let annotationsIDB: AnnotationsIndexedDB | undefined = $state();
  let isPlaying = $state(false);
  let volume = $state({ level: 0, mute: false });

  let commandOpen = $state(false);

  window.onkeydown = (e) => {
    const activeElement = document.activeElement;
    const isTyping =
      activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA" || activeElement?.isContentEditable;

    if (isTyping) return;

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
      break;
    }
  };

  // for now
  $effect(() => {
    if (url && player && url != player?.source()) {
      player?.source(url); //...
    }
  });

  onMount(async () => {
    $boundingBoxes = [];

    context.tools.setTools([
      {
        label: "Visual",
        type: DEFAULT_MODE,
        iconName: "mouse-pointer-2",
        handleClick: () => context.commands.run("tools.visual"),
      },
      {
        label: "Bounding Box",
        type: IDAH_VIDEO_BOUNDING_BOX,
        iconName: "vector-square",
        handleClick: () => context.commands.run("tools.bounding_box"),
      },
      {
        label: "Notes",
        type: IDAH_NOTE,
        iconName: "message-circle",
        disabled: context.workflowStep !== "review", // Note: This should be checked with dataset.workflow_configuration.noteable_steps after Tojo implements it
        handleClick: () => context.commands.run("tools.note"),
      },
    ]);

    $effect(() => context.tools.setTool(mode));

    annotationsIndexedDB(["idah-video", "entry", entry_id].join(":")).then((idb) => {
      annotationsIDB = idb;
      fetchAnnotations(idb).then(() => {
        // quick fix if unsynced data, though we dont have way to send it anyway for now if so
        idb?.getAllIndex("type", ENTRY_ROOT).then((anns) => ($entryRoot = anns[0]));
      });
    }, console.error);

    function fetchAnnotations(db: AnnotationsIndexedDB, page = 1, itemsPerPage = 100): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        context.annotations.list({ entry_id: entry_id }, { page, itemsPerPage }).then((r) => {
          let d = (r as AnnotationRecord[]).map((a) => {
            const annotation = {
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
            if (annotation.shape.type == ENTRY_ROOT) $entryRoot = annotation;
            return annotation;
          });

          if (d.length) {
            db.addAnnotations(d).then(() => {
              $idb_updated_at = new Date();
              fetchAnnotations(db, page + 1).then(resolve, reject);
            });
          } else {
            resolve();
          }
        });
      });
    }

    registerVisualModeShortcuts({
      context,
      player: () => player,
      toggleCommandCB: () => {
        commandOpen = !commandOpen;
      },
      flush: () => context.annotations.flush(),
      switch_mode: (mode: string) => {
        let tool;
        switch (mode) {
          case IDAH_VIDEO_BOUNDING_BOX:
            tool = "tools.bounding_box";
            break;
          case IDAH_NOTE:
            tool = "tools.note";
            break;
          default:
            tool = "tools.visual";
        }
        console.log({ context, commands: context.commands, mode, tool });
        context.commands.run(tool);
      },
      zoom: { in: overlay.zoomIn, out: overlay.zoomOut },
    });
  });

  // need to store dependancy and extract thos commands definitions
  context.commands.on("annotation.add", (props: { shape: AnnotationShape; value: AnnotationValue }) => {
    const id = uuidv7(); // for now move to annotation driver create asap

    return {
      name: "new annotation",
      async apply() {
        const createdAt = new Date();
        let annotation = {
          shape: props.shape,
          value: props.value,
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

        // quick fix for now as we mode id still here
        if (annotation.shape.type == ENTRY_ROOT) $entryRoot = annotation;

        let p = context.annotations.create(id, annotation.shape, annotation.value);

        p.then(async () => {
          let a = await annotationsIDB?.get("annotations", id);

          if (a && a.metadata.updatedAt.valueOf() == createdAt.valueOf()) {
            a.synced = true;
            selectedAnnotation = a;
            await annotationsIDB?.addAnnotations([a]);
            $idb_updated_at = new Date();
          }
        }, console.error);
      },
      async undo() {
        if (id == selectedAnnotation?.metadata.id) selectedAnnotation = undefined;

        if ($entryRoot?.metadata.id == id) $entryRoot = undefined;

        await annotationsIDB?.deleteAnnotation(id);
        $idb_updated_at = new Date();

        let _p = context.annotations.delete(id);
      },
      isCombinable: () => false,
      combine: (cmd) => cmd,
    };
  });
  context.commands.on("annotation.delete", async (props: { id: string }) => {
    const annotation = await annotationsIDB?.get("annotations", props.id);

    if (!annotation) return toast.error("cannot remove not found annotation");

    return {
      name: "remove annotation",
      async apply() {
        if (props.id == selectedAnnotation?.metadata.id) selectedAnnotation = undefined;

        await annotationsIDB?.deleteAnnotation(props.id);
        $idb_updated_at = new Date();

        if ($entryRoot?.metadata.id == props.id) $entryRoot = undefined;

        let p = context.annotations.delete(props.id);

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

        if (annotation.shape.type == ENTRY_ROOT) $entryRoot = annotation;
        let p = context.annotations.create(props.id, annotation.shape, annotation.value);

        p.then(async () => {
          let annotation = await annotationsIDB?.get("annotations", props.id);

          if (annotation?.metadata.updatedAt.valueOf() == createdAt.valueOf()) {
            annotation.synced = true;
            if (annotation?.shape.type == ENTRY_ROOT) $entryRoot = annotation;

            await annotationsIDB?.addAnnotations([annotation]);
            $idb_updated_at = new Date();
          }
        });
      },
      isCombinable: () => false,
      combine: (cmd) => cmd,
    };
  });
  context.commands.on("keyframe.add", async (props: { id: string; selection: VideoFrameSelection }) => {
    const annotation = await annotationsIDB?.get("annotations", props.id);

    if (!annotation) return console.warn({ addSelection, annotation });

    const selection = $state.snapshot(props.selection) as VideoFrameSelection;

    const from = annotation.shape.frames.find((f: VideoFrameSelection) => f.frame == selection.frame);

    const start = annotation.shape.start;
    const end = annotation.shape.end;
    return {
      name: "add bounding box selection",
      async apply() {
        const v = await annotationsIDB?.get("annotations", props.id);

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

        await annotationsIDB?.addAnnotations([v]);
        $idb_updated_at = new Date();
        selectedAnnotation = v;

        let p = context.annotations.update({
          id: v.metadata.id,
          dimensions: v.shape,
          annotation: v.value,
        });

        p.then(async () => {
          const v = await annotationsIDB?.get("annotations", props.id);
          if (v && v?.metadata.updatedAt.valueOf() == updatedAt.valueOf()) {
            v.synced = true;
            await annotationsIDB?.addAnnotations([v]);
            selectedAnnotation = v;
            $idb_updated_at = new Date();
          }
        }, console.error);
      },
      async undo() {
        const v = await annotationsIDB?.get("annotations", props.id);

        if (!v) return toast.error("bounding box not found");

        const updatedAt = new Date();
        v.shape = {
          ...v.shape,
          start,
          end,
          frames: from
            ? [...v.shape.frames.filter((f: VideoFrameSelection) => f.frame != selection.frame), from]
            : v.shape.frames.filter((f: VideoFrameSelection) => f.frame != selection.frame),
        };
        v.metadata.updatedAt = updatedAt;
        v.synced = false;

        // ... indexdb queries need reviews
        await annotationsIDB?.deleteKeyFrame(v, selection.frame);
        await annotationsIDB?.addAnnotations([v]);
        selectedAnnotation = v;
        $idb_updated_at = new Date();

        let p = context.annotations.update({
          id: v.metadata.id,
          dimensions: v.shape,
          annotation: v.value,
        });

        p.then(async () => {
          const v = await annotationsIDB?.get("annotations", props.id);
          if (v?.metadata.updatedAt.valueOf() == updatedAt.valueOf()) {
            // if (v.metadata.updatedAt == updatedAt) {
            v.synced = true;
            await annotationsIDB?.addAnnotations([v]);
            selectedAnnotation = v;
            $idb_updated_at = new Date();
          }
        });
      },
      isCombinable: () => false,
      combine: (c) => c,
    };
  });
  context.commands.on("keyframe.delete", async (props: { annotationId: string; frame: number }) => {
    const annotation = await annotationsIDB?.get("annotations", props.annotationId);

    if (!annotation) return toast.error("cannot remove selection, annotation not found");

    let index = annotation.shape.frames.findIndex((v: VideoFrameSelection) => v.frame == props.frame);
    if (index == -1) return toast.warning("No frame to remove");

    let selection = annotation.shape.frames[index];

    return {
      name: "delete bounding box keyframe",
      async apply() {
        const updatedAt = new Date();
        const annotation = await annotationsIDB?.get("annotations", props.annotationId);

        if (!annotation) return toast.error("cannot remove keyframe, annotation not found");

        let index = annotation.shape.frames.findIndex((v: VideoFrameSelection) => v.frame == props.frame);
        if (index == -1) return toast.warning("No frame to remove");

        let newframes = annotation.shape.frames.filter((v: VideoFrameSelection) => v.frame != props.frame);
        annotation.shape = {
          start: newframes.reduce(
            (acc: number, v: VideoFrameSelection) => (v.frame <= acc || acc == -1 ? v.frame : acc),
            -1,
          ),
          end: newframes.reduce(
            (acc: number, v: VideoFrameSelection) => (v.frame >= acc || acc == -1 ? v.frame : acc),
            -1,
          ),
          type: annotation.shape.type,
          frames: newframes,
        };
        annotation.metadata.updatedAt = updatedAt;
        await annotationsIDB?.deleteKeyFrame(annotation, props.frame);
        $idb_updated_at = new Date();

        selectedAnnotation = annotation;

        let p = context.annotations.update({
          id: annotation.metadata.id,
          dimensions: annotation.shape,
          annotation: annotation.value,
        });

        p.then(async () => {
          const annotation = await annotationsIDB?.get("annotations", props.annotationId);
          if (annotation && annotation.metadata.updatedAt == updatedAt) {
            annotation.synced = true;
            await annotationsIDB?.addAnnotations([annotation]);
            selectedAnnotation = annotation;
            $idb_updated_at = new Date();
          }
        });
      },
      async undo() {
        const updatedAt = new Date();
        let annotation = await annotationsIDB?.get("annotations", props.annotationId);

        if (!annotation) return toast.error("cannot undo remove selection, annotation not found");

        let newframes = [...annotation.shape.frames.filter((v) => v.frame != props.frame), selection];
        annotation.shape = {
          start: newframes.reduce((acc, v) => (v.frame <= acc || acc == -1 ? v.frame : acc), -1),
          end: newframes.reduce((acc, v) => (v.frame >= acc || acc == -1 ? v.frame : acc), -1),
          type: annotation.shape.type,
          frames: newframes,
        };
        annotation.metadata.updatedAt = updatedAt;
        annotation.synced = false;
        selectedAnnotation = annotation;

        await annotationsIDB?.addKeyFrame(annotation, selection);
        $idb_updated_at = new Date();

        let p = context.annotations.update({
          id: annotation.metadata.id,
          dimensions: annotation.shape,
          annotation: annotation.value,
        });

        p.then(async () => {
          const annotation = await annotationsIDB?.get("annotations", props.annotationId);
          if (annotation && annotation.metadata.updatedAt == updatedAt) {
            annotation.synced = true;
            await annotationsIDB?.addAnnotations([annotation]);
            selectedAnnotation = annotation;
            $idb_updated_at = new Date();
          }
        });
      },
      isCombinable: () => false,
      combine: (_c) => _c,
    };
  });
  context.commands.on(
    "annotation.update",
    (props: {
      annotation: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>;
      value: AnnotationValue;
    }) => {
      const annotationId = props.annotation.metadata.id;
      const value_from = props.annotation.value;
      return {
        name: "update annotation value",
        async apply() {
          const annotation = await annotationsIDB?.get("annotations", annotationId);
          const updatedAt = new Date();
          if (annotation) {
            annotation.value = props.value;
            annotation.metadata.updatedAt = updatedAt;
            annotation.synced = false;
            selectedAnnotation = annotation;

            await annotationsIDB?.addAnnotations([annotation]);
            $idb_updated_at = new Date();

            if ($entryRoot?.metadata.id == annotation.metadata.id) $entryRoot = annotation;

            let p = context.annotations.update({
              id: annotation.metadata.id,
              dimensions: annotation.shape,
              annotation: props.value,
            });

            p.then(async () => {
              const annotation = await annotationsIDB?.get("annotations", annotationId);
              if (annotation && annotation.metadata.updatedAt.valueOf() == updatedAt.valueOf()) {
                annotation.synced = true;
                selectedAnnotation = annotation;
                if ($entryRoot?.metadata.id == annotation.metadata.id) $entryRoot = annotation;
                await annotationsIDB?.addAnnotations([annotation]);
                $idb_updated_at = new Date();
              }
            });
          }
        },
        async undo() {
          const annotation = await annotationsIDB?.get("annotations", annotationId);
          if (annotation) {
            const updatedAt = new Date();
            annotation.value = value_from;
            annotation.metadata.updatedAt = updatedAt;
            annotation.synced = false;

            selectedAnnotation = annotation;

            let p = context.annotations.update({
              id: annotation.metadata.id,
              dimensions: annotation.shape,
              annotation: value_from,
            });

            if ($entryRoot?.metadata.id == annotation.metadata.id) $entryRoot = annotation;

            p.then(async () => {
              const annotation = await annotationsIDB?.get("annotations", annotationId);
              if (annotation && annotation.metadata.updatedAt.valueOf() == updatedAt.valueOf()) {
                annotation.synced = true;
                selectedAnnotation = annotation;
                if ($entryRoot?.metadata.id == annotation.metadata.id) $entryRoot = annotation;
                await annotationsIDB?.addAnnotations([annotation]);
                $idb_updated_at = new Date();
              }
            });
          }
        },
        isCombinable: () => false,
        combine: (_c) => _c,
      };
    },
  );

  context.commands.on("tools.visual", () => {
    return {
      name: "visual tool",
      apply: () => {
        mode = DEFAULT_MODE;
        selectedAnnotation = undefined;
        annotationValue = {};
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (c) => c,
    };
  });
  context.commands.on("tools.bounding_box", () => {
    return {
      name: "bounding box tool",
      apply: () => {
        mode = IDAH_VIDEO_BOUNDING_BOX;
        selectedAnnotation = undefined;
        annotationValue = {};
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (c) => c,
    };
  });
  context.commands.on("tools.note", () => {
    return {
      name: "note tool",
      apply: () => {
        mode = IDAH_NOTE;
        selectedAnnotation = undefined;
        annotationValue = {};
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (c) => c,
    };
  });

  function addAnnotation(shape: AnnotationShape, value: AnnotationValue = {}) {
    const annotation = {
      // filter out indexed shape index noise for now
      shape: Object.fromEntries(
        Object.entries(shape).filter(([k, _]) => ["type", "frames", "start", "end"].includes(k)),
      ),
      value,
    };

    context.commands.run("annotation.add", annotation);
  }

  async function removeAnnotation(id: string) {
    context.commands.run("annotation.delete", { id });
  }

  async function addSelection(id: string, selection: VideoFrameSelection) {
    context.commands.run("keyframe.add", { id, selection });
  }

  async function deleteSelection(annotationId: string, frame: number) {
    context.commands.run("keyframe.delete", { annotationId, frame });
  }

  function onDeleteAnnotation(
    annotation: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>,
    frame?: number,
  ) {
    if (frame != undefined) deleteSelection(annotation.metadata.id, frame);
    else removeAnnotation(annotation.metadata.id);
  }

  let shapeSelectionArgs: [type: string, frame: number, _points: Point[], selectedId?: string] | undefined = $state();

  function onEditValue(value: AnnotationValue, valueMode: string) {
    let requirementFullfilled = requiredFullfilled(value, context.config[valueMode]?.properties);
    annotationValue = value;
    mode = valueMode;
    if (valueMode == ENTRY_ROOT && !selectedAnnotation && $entryRoot?.metadata.id) selectedAnnotation = $entryRoot;
    //wait for confirmation
    if (showPopOver) {
      if (selectedAnnotation) selectedAnnotation = { ...selectedAnnotation, value: annotationValue };
    } else {
      if (valueMode == ENTRY_ROOT && !selectedAnnotation) {
        if (value.category && value.category != "" && requirementFullfilled)
          addAnnotation({ type: valueMode }, $state.snapshot(value));
      } else if (selectedAnnotation) {
        selectedAnnotation = { ...selectedAnnotation, value: annotationValue };
        if (requirementFullfilled) updateAnnotationValue($state.snapshot(selectedAnnotation), $state.snapshot(value));
      } else if (shapeSelectionArgs && requirementFullfilled) {
        showPopOver = false;
        onShapeSelection(...shapeSelectionArgs);
      }
    }
  }

  function onShapeSelection(type: string, frame: number, _points: Point[] = [], selectedId?: string) {
    let points = $state.snapshot(_points) as Point[];
    if (!selectedId) {
      let annotation_value_from = $state.snapshot(annotationValue) as AnnotationValue;

      // todo proper validation
      let shape: AnnotationShape = { type };
      switch (type) {
        case DEFAULT_MODE:
          break;
        case IDAH_VIDEO_BOUNDING_BOX:
          shape = { ...shape, start: frame, end: frame, frames: [{ frame, points }] };
          break;
        default:
          throw `unhandled type ${type}`;
      }

      if (
        context.config[type]?.values.some((v) => v.id == annotation_value_from.category) &&
        requiredFullfilled(annotation_value_from, context.config[type]?.properties)
      ) {
        shapeSelectionArgs = undefined;
        addAnnotation(shape, annotation_value_from);
      } else {
        shapeSelectionArgs = [type, frame, _points, selectedId];
        showPopOver = true;
      }
    } else {
      addSelection(selectedId, { frame, points });
    }
  }

  function updateAnnotationValue(
    annotation: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>,
    value: AnnotationValue,
  ) {
    context.commands.run("annotation.update", { annotation, value });
  }

  function selectAnnotation(annotation?: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>) {
    selectedAnnotation = annotation;

    /**
     * Set mode to the annotation shape type when selecting an annotation
     */
    if (annotation?.shape.type) {
      mode = annotation.shape.type;
    } else if (mode === "note") {
      mode = "note";
    } else {
      mode = DEFAULT_MODE;
    }
  }

  let overlay: SvgOverlay;

  let annotations_promise: Promise<AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>[]> = $derived.by(
    () => {
      $idb_updated_at; // eslint-disable-line @typescript-eslint/no-unused-expressions
      if (!annotationsIDB) return new Promise((_, ko) => ko("no database"));

      let p = annotationsIDB.getAllStore("annotations");

      p.then((updated_annotations) => {
        console.debug({ $boundingBoxes: $state.snapshot($boundingBoxes), updated_annotations });
        $boundingBoxes = updated_annotations;
      });

      return p;
    },
  );

  let showPopOver = $state(false);
  let videoResizedAt = $state(new Date());

  function showNewNotePopup(params: OnAddNewNoteParams) {
    const { anchorType, position, annotationId } = params;
    context.notes.showNewNoteFeedPopup({
      anchor_type: anchorType,
      position: {
        ...position,
        /**
         * Need to be sent in pixels
         * Need to be sent the sidebar width to position the note correctly
         * Otherwise the note will be positioned left to the sidebar
         */
        sidebar_width: annotationSidebarWidthRem * 16,
      },
      annotationId: annotationId,
    });
  }

  function seekToFrame(frame: number) {
    player?.seekToFrame(frame);
  }
</script>

<div class="relative flex h-full w-full flex-col">
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

  <Popover
    open={showPopOver}
    onOpenChange={(open: boolean) => {
      showPopOver = open;
    }}
  >
    <PopoverTrigger></PopoverTrigger>

    <PopoverContent class="w-max">
      {#if annotationValue.category}
        <CategoryProperties
          type={mode}
          selectedCategory={annotationValue.category}
          {annotationValue}
          onSelectCategory={(s) => {
            if (s != mode) selectAnnotation();
            onEditValue({ category: annotationValue.category }, mode);
          }}
          onEditValue={(value) => value && onEditValue(value, mode)}
        />
      {:else}
        <AnnotationSidebar
          sidebarWidthRem={annotationSidebarWidthRem}
          db={annotationsIDB}
          {annotationValue}
          {currentFrame}
          {onEditValue}
          onSelectAnnotation={selectAnnotation}
          {onDeleteAnnotation}
          {context}
          {mode}
          selected_id={selectedAnnotation?.metadata.id}
        />
      {/if}
      <Button
        onclick={() => {
          showPopOver = false;
          annotationValue = {};
          shapeSelectionArgs = undefined;
          selectAnnotation();
        }}
      >
        Cancel
      </Button>
      <Button
        onclick={() => {
          showPopOver = false;
          switch (mode) {
            case ENTRY_ROOT:
              onShapeSelection(ENTRY_ROOT, currentFrame);
              break;
            default:
              if (shapeSelectionArgs) onShapeSelection(...shapeSelectionArgs);
          }
        }}
        disabled={shapeSelectionArgs == undefined && ENTRY_ROOT != mode}>Confirm</Button
      >
    </PopoverContent>
  </Popover>

  <SidebarProvider class="min-h-0 w-full" style="height: calc(100% - 30px)">
    <ResizablePaneGroup direction="vertical">
      <ResizablePane class="flex h-full" defaultSize={60} minSize={15}>
        <AnnotationSidebar
          db={annotationsIDB}
          {annotationValue}
          {currentFrame}
          {onEditValue}
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
            onAddNewNote={showNewNotePopup}
            onChangeFrame={seekToFrame}
            target_container={() => player_container}
            {videoResizedAt}
          >
            <!-- container context ?-->
            <Video
              bind:this={player}
              bind:element={player_container}
              onResize={() => {
                videoResizedAt = new Date();
              }}
              onFramesChange={(current, total, playing) => {
                currentFrame = current;
                totalFrames = total;
                isPlaying = playing;
                isPlaying = playing;
                // console.debug({onFramesChange: {current, total, playing}})
              }}
              onVolumeChange={(level, muted) => (volume = { level, muted })}
            />
          </SvgOverlay>
        </SidebarInset>
        <PropertiesSidebar {annotationValue} {onEditValue} {context} {mode} />
      </ResizablePane>

      <ResizableHandle withHandle></ResizableHandle>

      <ResizablePane defaultSize={25} minSize={10}>
        <AnnotationFooter>
          <AnnotationFooterToolbar>
            <VideoController
              bind:this={videoController}
              {isPlaying}
              {zoom}
              {scale}
              {currentFrame}
              {totalFrames}
              {volume}
              bind:video={player}
              onZoomChange={(z) => timelineTable.setZoom(z)}
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
              onSeekFrame={seekToFrame}
              {onDeleteAnnotation}
              onSelectAnnotation={selectAnnotation}
              onSelection={onShapeSelection}
              target_container={() => player_container}
              {videoResizedAt}
              onScaleChange={(s) => {
                scale = s;
              }}
              onZoomChange={(z) => {
                zoom = z;
              }}
            >
              <!-- container context ?-->
              <Video
                bind:this={player}
                bind:element={player_container}
                onResize={() => {
                  videoResizedAt = new Date();
                }}
                onFramesChange={(current, total, playing) => {
                  currentFrame = current;
                  totalFrames = total;
                  isPlaying = playing;
                  isPlaying = playing;
                  // console.debug({onFramesChange: {current, total, playing}})
                }}
                onVolumeChange={(level, muted) => (volume = { level, muted })}
              />
            </TimelineTable>
          </ScrollArea>
        </AnnotationFooter>
      </ResizablePane>
    </ResizablePaneGroup>
  </SidebarProvider>
</div>
