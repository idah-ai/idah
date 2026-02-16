<script lang="ts">
  import { onMount, setContext } from "svelte";
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
  import { Button } from "@/components/ui/button";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "@/components/ui/resizable";
  import { ScrollArea } from "@/components/ui/scroll-area";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { AnnotationRecord } from "@/data/model/dataset/annotations/record";
  import { ShortcutManager } from "@/shortcut/ShortcutManager";
  import { DEFAULT_MODE, ENTRY_ROOT, IDAH_NOTE, IDAH_VIDEO_BOUNDING_BOX, IDAH_POLYGON } from "./type";
  import type { AnnotationMetadata, AnnotationObj } from "@/context/AnnotationContext";
  import { requiredFullfilled } from "./video-annotation-activity/categoryProperties";
  import { boundingBoxes, entryRoot, idb_updated_at } from "./video-annotation-activity/idb_store.svelte";
  import { annotationsIndexedDB, AnnotationsIndexedDB } from "./video-annotation-activity/indexedDB";
  import { registerOnSelectBoxModeShortcuts, registerVisualModeShortcuts } from "./video-annotation-activity/shortcut";

  import AnnotationFooter from "./layout/footer/AnnotationFooter.svelte";
  import AnnotationFooterToolbar from "./layout/footer/AnnotationFooterToolbar.svelte";
  import AnnotationSidebar from "./layout/sidebar/annotation-sidebar.svelte";
  import PropertiesSidebar from "./layout/sidebar/properties-sidebar.svelte";
  import CategoryProperties from "./video-annotation-activity/categoryProperties/categoryProperties.svelte";
  import SvgOverlay, { type OnAddNewNoteParams } from "./video-annotation-activity/svg-overlay.svelte";
  import TimelineTable from "./video-annotation-activity/timeline-table/timeline-table.svelte";
  import Video from "./video-annotation-activity/video.svelte";
  import VideoController from "./video-annotation-activity/VideoController.svelte";

  import type { AnnotationShape, AnnotationValue } from "@/context/AnnotationContext";
  import type { IActivityContext } from "@/plugin/interface/Activity";
  import {
    type InterpolatedVertex,
    type Point,
    type VideoFrameSelection,
    type VideoShape,
    getInterpolatedFrame,
  } from "./video-annotation-activity/VideoAnnotationContext";
  // import { AnnotationShape } from "../../lib/context/AnnotationContext";

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
  let annotationSidebarResizablePercentage = $state<number>(16);
  let annotationSidebarWidthRem = $derived<number>(annotationSidebarResizablePercentage + 3);

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
  let volume = $state({ level: 0, muted: false });
  let tools: (
    | { label: string; type: string; iconName: string; handleClick: () => void }
    | { label: string; type: string; iconName: string; disabled: boolean; handleClick: () => void }
  )[] = $state([]);

  let commandOpen = $state(false);

  window.onkeydown = (e) => {
    const activeElement = document.activeElement;
    const isTyping =
      activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA" || activeElement?.isContentEditable;

    if (isTyping) return;

    const current_mode = ShortcutManager.getCurrentMode();
    const keymap = ShortcutManager.getEffectiveKeyMap(current_mode);

    if (!keymap || Object.keys(keymap).length === 0) return console.error("no keymap found");

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
    if (isPlaying && mode !== DEFAULT_MODE) {
      context.commands.run("tools.visual");
    }
  });

  onMount(async () => {
    $boundingBoxes = [];
    tools = [
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
        disabled: !["annotate", "review"].includes(context.workflowStep),
        handleClick: () => context.commands.run("tools.bounding_box"),
      },
      {
        label: "Polygon",
        type: IDAH_POLYGON,
        iconName: "polygon",
        disabled: !["annotate", "review"].includes(context.workflowStep),
        handleClick: () => context.commands.run("tools.polygon"),
      },
      {
        label: "Notes",
        type: IDAH_NOTE,
        iconName: "message-circle",
        disabled: !["annotate", "review", "done"].includes(context.workflowStep), // Note: Only allow to create note when workflow steps are "annotate" and "review"
        handleClick: () => context.commands.run("tools.note"),
      },
    ];

    context.tools.setTools(tools);

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
              hidden: false,
              locked: false,
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
          case IDAH_POLYGON:
            tool = "tools.polygon";
            break;
          default:
            tool = "tools.visual";
        }

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
          locked: false,
          hidden: false,
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

    if (!annotation) return showToast.error({ title: "cannot remove not found annotation" });

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
          locked: false,
          hidden: false,
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

        if (!v) return showToast.error({ title: "Bounding box not found" });

        const updatedAt = new Date();
        v.shape = {
          ...v.shape,
          start: v.shape.start <= selection.frame ? v.shape.start : selection.frame,
          end: v.shape.end >= selection.frame ? v.shape.end : selection.frame,
          frames: [...v.shape.frames.filter((f) => f.frame != selection.frame), selection],
        };
        v.metadata.updatedAt = updatedAt;
        v.synced = false;

        selectedAnnotation = v;

        await annotationsIDB?.addAnnotations([v]);
        $idb_updated_at = new Date();

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

        if (!v) return showToast.error({ title: "Bounding box not found" });

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

    if (!annotation) return showToast.error({ title: "cannot remove selection, annotation not found" });

    let index = annotation.shape.frames.findIndex((v: VideoFrameSelection) => v.frame == props.frame);
    if (index == -1) return showToast.warning({ title: "No frame to remove" });

    let selection = annotation.shape.frames[index];

    return {
      name: "delete bounding box keyframe",
      async apply() {
        const updatedAt = new Date();
        const annotation = await annotationsIDB?.get("annotations", props.annotationId);

        if (!annotation) return showToast.error({ title: "cannot remove keyframe, annotation not found" });

        let index = annotation.shape.frames.findIndex((v: VideoFrameSelection) => v.frame == props.frame);
        if (index == -1) return showToast.warning({ title: "No frame to remove" });

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
        await annotationsIDB?.addAnnotations([annotation]);
        $idb_updated_at = new Date();

        selectedAnnotation = annotation;

        let p = context.annotations.update({
          id: annotation.metadata.id,
          dimensions: annotation.shape,
          annotation: annotation.value,
        });

        p.then(async () => {
          const annotation = await annotationsIDB?.get("annotations", props.annotationId);
          if (annotation && annotation?.metadata.updatedAt.valueOf() == updatedAt.valueOf()) {
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

        if (!annotation) return showToast.error({ title: "cannot undo remove selection, annotation not found" });

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
          if (annotation && annotation?.metadata.updatedAt.valueOf() == updatedAt.valueOf()) {
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

  context.commands.on("annotation.toggleHidden", async (props: { id: string }) => {
    const annotation = await annotationsIDB?.get("annotations", props.id);

    if (!annotation) return showToast.error({ title: "cannot toggle hidden, annotation not found" });

    const wasHidden = annotation.hidden;

    return {
      name: "toggle hidden",
      apply: () => onVisibility(!wasHidden, annotation),
      undo: () => onVisibility(wasHidden, annotation),
      isCombinable: () => true,
      combine: (c) => c,
    };
  });

  context.commands.on("annotation.toggleLocked", async (props: { id: string }) => {
    const annotation = await annotationsIDB?.get("annotations", props.id);

    if (!annotation) return showToast.error({ title: "cannot toggle locked, annotation not found" });

    const wasLocked = annotation.locked;

    return {
      name: "toggle locked",
      apply: () => onLock(!wasLocked, annotation),
      undo: () => onLock(wasLocked, annotation),
      isCombinable: () => true,
      combine: (c) => c,
    };
  });

  context.commands.on("annotation.split", async (props: { id: string; at: number }) => {
    const annotation = await annotationsIDB?.get("annotations", props.id);

    if (!annotation) return showToast.error({ title: "cannot split annotation, annotation not found" });

    const splitAt = props.at;

    if (annotation.shape.start >= splitAt) return console.log("cannot split before/at start frame");
    if (annotation.shape.end < splitAt) return console.log("cannot split after end frame");

    const newId = uuidv7();
    const createdAt = new Date();

    // original annotation data, prepare for undoing
    const originalEnd = annotation.shape.end;
    const originalFrames = annotation.shape.frames;
    const originalUpdatedAt = annotation.metadata.updatedAt;

    // part 1: original annotation, to be updated (0 to splitAt - 1)
    const part1End = splitAt - 1;
    const part1Frames = annotation.shape.frames.filter((f: VideoFrameSelection) => f.frame <= part1End);

    // ensure Part 1 has an ending keyframe at the splitAt - 1 frame point if it doesn't already
    if (!part1Frames.find((f: VideoFrameSelection) => f.frame === part1End)) {
      const interpolated = getInterpolatedFrame(annotation.shape as VideoShape, part1End);
      if (interpolated) {
        const normalizedPoints = normalizePoints(interpolated.points);
        if (normalizedPoints) {
          part1Frames.push({
            frame: part1End,
            points: normalizedPoints,
            angle: interpolated.angle || 0,
          });
        }
      }
      part1Frames.sort((a, b) => a.frame - b.frame);
    }

    // part 2: new annotation, to be created (splitAt to end)
    const part2Start = splitAt;
    const part2End = splitAt === annotation.shape.end ? part2Start : originalEnd;
    const part2Frames = annotation.shape.frames.filter((f: VideoFrameSelection) => f.frame >= part2Start);

    // ensure Part 2 has a starting keyframe at part2Start frame point if it doesn't already
    if (!part2Frames.find((f: VideoFrameSelection) => f.frame === part2Start)) {
      const interpolated = getInterpolatedFrame(annotation.shape as VideoShape, part2Start);
      if (interpolated) {
        const normalizedPoints = normalizePoints(interpolated.points);
        if (normalizedPoints) {
          part2Frames.push({
            frame: part2Start,
            points: normalizedPoints,
            angle: interpolated.angle || 0,
          });
        }
      }
      part2Frames.sort((a, b) => a.frame - b.frame);
    }

    return {
      name: "split annotation",
      async apply() {
        // Update Part 1
        const a1 = await annotationsIDB?.get("annotations", props.id);
        if (a1) {
          a1.shape.end = part1End;
          a1.shape.frames = part1Frames;
          a1.metadata.updatedAt = createdAt;
          a1.synced = false;
          await annotationsIDB?.addAnnotations([a1]);
          // context update
          let p = context.annotations.update({
            id: a1.metadata.id,
            dimensions: a1.shape,
            annotation: a1.value,
          });

          p.then(async () => {
            const annotation = await annotationsIDB?.get("annotations", props.id);
            if (annotation && annotation.metadata.updatedAt.valueOf() == createdAt.valueOf()) {
              annotation.synced = true;
              if ($entryRoot?.metadata.id == annotation.metadata.id) $entryRoot = annotation;
              await annotationsIDB?.addAnnotations([annotation]);
              $idb_updated_at = new Date();
            }
          });
        }

        // Create Part 2
        let a2 = {
          ...annotation,
          shape: {
            ...annotation.shape,
            start: part2Start,
            end: part2End,
            frames: part2Frames,
          },
          value: { ...annotation.value }, // copy value
          metadata: {
            ...annotation.metadata,
            id: newId,
            createdAt,
            updatedAt: createdAt,
          },
          synced: false,
          locked: false,
          hidden: false,
        };

        if (a2.shape.type == ENTRY_ROOT) $entryRoot = a2;

        await annotationsIDB?.addAnnotations([a2]);
        $idb_updated_at = new Date();

        let p2 = context.annotations.create(newId, a2.shape, a2.value);
        p2.then(async () => {
          const annotation = await annotationsIDB?.get("annotations", newId);
          if (annotation && annotation.metadata.updatedAt.valueOf() == createdAt.valueOf()) {
            annotation.synced = true;
            if ($entryRoot?.metadata.id == annotation.metadata.id) $entryRoot = annotation;
            await annotationsIDB?.addAnnotations([annotation]);
            $idb_updated_at = new Date();
          }
        });
      },
      async undo() {
        // restore original of part 1
        const a1 = await annotationsIDB?.get("annotations", props.id);
        if (a1) {
          a1.shape.end = originalEnd;
          a1.shape.frames = originalFrames;
          a1.metadata.updatedAt = originalUpdatedAt;
          a1.synced = false;
          await annotationsIDB?.addAnnotations([a1]);

          let p = context.annotations.update({
            id: a1.metadata.id,
            dimensions: a1.shape,
            annotation: a1.value,
          });

          p.then(async () => {
            const annotation = await annotationsIDB?.get("annotations", props.id);
            // verify using originalUpdatedAt
            if (annotation && annotation.metadata.updatedAt.valueOf() == originalUpdatedAt.valueOf()) {
              annotation.synced = true;
              if ($entryRoot?.metadata.id == annotation.metadata.id) $entryRoot = annotation;
              await annotationsIDB?.addAnnotations([annotation]);
              $idb_updated_at = new Date();
            }
          });
        }

        // delete part 2
        await annotationsIDB?.deleteAnnotation(newId);
        $idb_updated_at = new Date();
        context.annotations.delete(newId);

        if ($entryRoot?.metadata.id == newId) $entryRoot = undefined;
      },
      isCombinable: () => false,
      combine: (c) => c,
    };
  });

  context.commands.on("tools.visual", () => {
    return {
      name: "visual tool",
      apply: () => {
        mode = DEFAULT_MODE;
        selectedAnnotation = undefined;
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
        selectedAnnotation = {
          shape: { type: IDAH_VIDEO_BOUNDING_BOX },
          value: {},
          metadata: { id: "", createdAt: new Date(), updatedAt: new Date() },
          synced: false,
          locked: false,
          hidden: false,
        };
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
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (c) => c,
    };
  });

  context.commands.on("tools.polygon", () => {
    return {
      name: "polygon tool",
      apply: () => {
        mode = IDAH_POLYGON;
        selectedAnnotation = {
          shape: { type: IDAH_POLYGON },
          value: {},
          metadata: { id: "", createdAt: new Date(), updatedAt: new Date() },
          synced: false,
          locked: false,
          hidden: false,
        };
        annotationValue = {};
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (c) => c,
    };
  });

  function addAnnotation(shape: AnnotationShape, value: AnnotationValue = {}) {
    if (!["review", "annotate"].includes(context.workflowStep)) return;
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
    if (!["review", "annotate"].includes(context.workflowStep)) return;

    context.commands.run("annotation.delete", { id });
  }

  async function addSelection(id: string, selection: VideoFrameSelection) {
    if (!["review", "annotate"].includes(context.workflowStep)) return;

    context.commands.run("keyframe.add", { id, selection });
  }

  async function deleteSelection(annotationId: string, frame: number) {
    if (!["review", "annotate"].includes(context.workflowStep)) return;

    context.commands.run("keyframe.delete", { annotationId, frame });
  }

  function onDeleteAnnotation(
    annotation: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>,
    frame?: number,
  ) {
    if (!["review", "annotate"].includes(context.workflowStep)) return;

    if (frame != undefined) deleteSelection(annotation.metadata.id, frame);
    else removeAnnotation(annotation.metadata.id);
  }

  let shapeSelectionArgs:
    | [type: string, frame: number, _points: Point[], angle: number, selectedId?: string]
    | undefined = $state();

  function onEditValue(value: AnnotationValue, valueMode: string) {
    if (!["annotate", "review"].includes(context.workflowStep)) return;

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

  function onShapeSelection(
    type: string,
    frame: number,
    _points: Point[] = [],
    angle: number = 0,
    selectedId?: string,
  ) {
    if (!["review", "annotate"].includes(context.workflowStep) || mode === "note") return;

    let points = $state.snapshot(_points) as Point[];
    if (!selectedId) {
      let annotation_value_from = $state.snapshot(annotationValue) as AnnotationValue;

      // todo proper validation
      let shape: AnnotationShape = { type };
      switch (type) {
        case DEFAULT_MODE:
          break;
        case IDAH_VIDEO_BOUNDING_BOX:
          shape = { ...shape, start: frame, end: frame, frames: [{ frame, angle, points }] };
          break;
        case IDAH_POLYGON:
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
        shapeSelectionArgs = [type, frame, _points, angle, selectedId];
        showPopOver = true;
      }
    } else {
      addSelection(selectedId, { frame, angle, points });
    }
  }

  function updateAnnotationValue(
    annotation: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>,
    value: AnnotationValue,
  ) {
    if (annotation?.locked || !["review", "annotate"].includes(context.workflowStep)) return;

    context.commands.run("annotation.update", { annotation, value });
  }

  function selectAnnotation(annotation?: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>) {
    selectedAnnotation = annotation;

    /**
     * Set mode to the annotation shape type when selecting an annotation
     */
    if (mode === "note") {
      return;
    } else if (annotation?.shape.type && ["review", "annotate"].includes(context.workflowStep)) {
      mode = annotation.shape.type;
      // Register selection-specific shortcuts for the current mode
      registerOnSelectBoxModeShortcuts(context, annotation.metadata.id, () => currentFrame);
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
      annotation_id: annotationId,
    });
  }

  function seekToFrame(frame: number) {
    player?.seekToFrame(frame);
  }

  function onVisibility(
    hidden: boolean,
    annotation?: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>,
  ) {
    if (annotation) {
      annotation.hidden = hidden;
      if (annotation.metadata.id == selectedAnnotation?.metadata.id) selectedAnnotation.hidden = hidden;
      if (annotation.shape.type == ENTRY_ROOT) $entryRoot = annotation;

      annotationsIDB?.addAnnotations([annotation]).then(() => ($idb_updated_at = new Date()));
    } else {
      allHidden = hidden;
      if (selectedAnnotation) selectedAnnotation.hidden = hidden;
      annotationsIDB?.updateAllVisibility(hidden).then(() => ($idb_updated_at = new Date()));
    }
  }

  function onLock(locked: boolean, annotation?: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>) {
    if (annotation) {
      annotation.locked = locked;
      if (annotation.metadata.id == selectedAnnotation?.metadata.id) selectedAnnotation.locked = locked;
      if (annotation.shape.type == ENTRY_ROOT) $entryRoot = annotation;
      annotationsIDB?.addAnnotations([annotation]).then(() => ($idb_updated_at = new Date()));
    } else {
      allLocked = locked;
      if ($entryRoot) $entryRoot.locked = locked;
      if (selectedAnnotation) selectedAnnotation.locked = locked;
      annotationsIDB?.updateAllLock(locked).then(() => ($idb_updated_at = new Date()));
    }
  }

  // Helper function to normalize interpolated points to Point[]
  function normalizePoints(points: Point[] | InterpolatedVertex[] | undefined): Point[] | undefined {
    if (!points) return undefined;
    // Check if first element is InterpolatedVertex by checking if it has a 'point' property
    if (points.length > 0 && typeof points[0] === 'object' && 'point' in points[0]) {
      return (points as InterpolatedVertex[]).map(item => item.point);
    }
    return points as Point[];
  }

  let allHidden: boolean = $state(false);
  let allLocked: boolean = $state(false);
</script>

<div class="relative flex h-full w-full flex-col">
  {#key [ShortcutManager, ShortcutManager.currentMode, ShortcutManager.getCurrentMode(), selectedAnnotation]}
    <CommandDialog bind:open={commandOpen} accesskey={ShortcutManager.getCurrentMode()}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading={`MODE: ${ShortcutManager.getCurrentMode()}`}>
          {#each Object.entries(ShortcutManager.getEffectiveKeyMap() || {}) as [key, value] (key)}
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

    <PopoverContent class="w-auto min-w-64 p-0">
      {#if annotationValue.category}
        <div class="p-2">
          <CategoryProperties
            type={mode}
            selectedCategory={annotationValue.category}
            {annotationValue}
            onSelectCategory={(categoryId) => {
              // categoryId is the new category ID selected by the user
              // Create a new value object with the updated category
              const newValue = {
                category: categoryId,
                attributes: annotationValue.attributes || {},
              };
              onEditValue(newValue, mode);
            }}
            onEditValue={(value) => value && onEditValue(value, mode)}
            disabled={false}
          />
        </div>
      {:else}
        <AnnotationSidebar
          sidebarWidthRem={annotationSidebarWidthRem}
          class="rounded-t-lg"
          db={annotationsIDB}
          {annotationValue}
          {currentFrame}
          {onEditValue}
          onSelectAnnotation={selectAnnotation}
          {onDeleteAnnotation}
          {onLock}
          {onVisibility}
          {context}
          {mode}
          selectedAnnotationId={selectedAnnotation?.metadata.id}
        />
      {/if}
      <div class=" flex justify-end gap-2 p-2">
        <Button
          size="sm"
          variant="outline"
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
          size="sm"
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
      </div>
    </PopoverContent>
  </Popover>

  <div id="plugin::idah-video" class="flex min-h-0 w-full flex-1">
    <ResizablePaneGroup direction="vertical">
      <ResizablePane defaultSize={60} minSize={15}>
        <ResizablePaneGroup direction="horizontal">
          <ResizablePane minSize={14} defaultSize={annotationSidebarResizablePercentage} maxSize={20}>
            <AnnotationSidebar
              sidebarWidthRem={annotationSidebarWidthRem}
              db={annotationsIDB}
              {annotationValue}
              {currentFrame}
              {onEditValue}
              onSelectAnnotation={selectAnnotation}
              {onDeleteAnnotation}
              {onLock}
              {onVisibility}
              {context}
              {mode}
              selectedAnnotationId={selectedAnnotation?.metadata.id}
            />
          </ResizablePane>

          <!--
            NOTE: Can not resize annotation sidebar,
            as it will affect the note overlay and svg overlay
            <ResizableHandle withHandle />
          -->

          <ResizablePane defaultSize={75}>
            <section id="video-section" class="flex h-full w-full flex-1">
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

              <PropertiesSidebar
                {annotationValue}
                {onEditValue}
                {context}
                {mode}
                disabled={!!selectedAnnotation?.locked}
              />
            </section>
          </ResizablePane>
        </ResizablePaneGroup>
      </ResizablePane>

      <ResizableHandle withHandle />

      <ResizablePane defaultSize={25} minSize={15}>
        <AnnotationFooter>
          <AnnotationFooterToolbar>
            <VideoController
              bind:this={videoController}
              {isPlaying}
              {zoom}
              {currentFrame}
              {totalFrames}
              {volume}
              bind:video={player}
              {selectedAnnotation}
              onZoomChange={(z) => timelineTable.setZoom(z)}
            />
          </AnnotationFooterToolbar>

          <ScrollArea class="h-[calc(100%-3rem)]">
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
              {onLock}
              {onVisibility}
              {allHidden}
              {allLocked}
              onSelectAnnotation={selectAnnotation}
              {isPlaying}
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
  </div>
</div>
