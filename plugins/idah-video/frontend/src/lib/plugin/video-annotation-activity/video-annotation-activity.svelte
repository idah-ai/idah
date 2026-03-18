<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { uuidv7 } from "uuidv7";

  import { Button } from "$lib/components/ui/button";
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
  import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/popover";
  import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "$lib/components/ui/resizable";
  import { ScrollArea } from "$lib/components/ui/scroll-area";

  import { ShortcutManager } from "$idah/shortcut/shortcut-manager";
  import { showToast } from "$lib/components/ui/toast/index.svelte";

  import { DEFAULT_MODE, ENTRY_ROOT, IDAH_NOTE, IDAH_VIDEO_BOUNDING_BOX, IDAH_VIDEO_POLYGON } from "$lib/plugin/type";
  import { requiredFullfilled } from "$lib/plugin/video-annotation-activity/category-properties";
  import { annotationsIndexedDB, AnnotationsIndexedDB } from "$lib/plugin/video-annotation-activity/indexedDB";
  import {
    registerOnSelectBoxModeShortcuts,
    registerVisualModeShortcuts,
  } from "$lib/plugin/video-annotation-activity/shortcut";
  import { boundingBoxes, entryRoot, idbUpdatedAt } from "$lib/plugin/video-annotation-activity/store/idb-store.svelte";
  import {
    deselectAnnotation,
    deselectAnnotationGroup,
    selectedAnnotation,
    selectedAnnotationGroup,
    setSelectedAnnotation,
  } from "$lib/plugin/video-annotation-activity/store/store";

  import AnnotationFooterToolbar from "$lib/plugin/layout/footer/annotation-footer-toolbar.svelte";
  import AnnotationFooter from "$lib/plugin/layout/footer/annotation-footer.svelte";
  import AnnotationSidebar from "$lib/plugin/layout/sidebar/annotation-sidebar.svelte";
  import PropertiesSidebar from "$lib/plugin/layout/sidebar/properties-sidebar.svelte";
  import CategoryProperties from "$lib/plugin/video-annotation-activity/category-properties/category-properties.svelte";
  import SvgOverlay, { type OnAddNewNoteParams } from "$lib/plugin/video-annotation-activity/svg-overlay.svelte";
  import TimelineTable from "$lib/plugin/video-annotation-activity/timeline-table/timeline-table.svelte";
  import VideoController from "$lib/plugin/video-annotation-activity/video/video-controller.svelte";
  import Video from "$lib/plugin/video-annotation-activity/video/video.svelte";

  import type { IActivityContext } from "$idah/context/activity-context";
  import type { AnnotationGroup, AnnotationShape, AnnotationValue } from "$idah/context/annotation-context";
  import {
    type InterpolatedVertex,
    type Point,
    type VideoAnnotationObject,
    type VideoFrameSelection,
    type VideoShape,
    getInterpolatedFrame,
  } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";
  import { showErrorToast } from "$lib/utils/error/error.toasts";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();

  // Contexts
  setContext("context", context);

  // Variables
  let { id: entryId, mediaUrl } = $derived(context);
  let player: Video | undefined = $state();
  let player_container: HTMLDivElement | undefined = $state();
  let currentFrame = $state(0);
  let totalFrames = $state(0);

  let mode: string = $state("visual");
  let annotationSidebarResizablePercentage = $state<number>(16);
  let annotationSidebarWidthRem = $derived<number>(annotationSidebarResizablePercentage + 3);

  let annotationId = $derived<string | undefined>($selectedAnnotation ? $selectedAnnotation.metadata.id : undefined);
  let annotationValue: AnnotationValue = $derived($selectedAnnotation?.value || {});

  let zoom = $state(85);
  let scale = $state(1);
  let timelineTable: TimelineTable;

  let annotationsIDB: AnnotationsIndexedDB | undefined = $state();
  let isPlaying = $state(false);
  let volume = $state({ level: 0, muted: false });
  let tools: (
    | { label: string; type: string; iconName: string; handleClick: () => void }
    | {
        label: string;
        type: string;
        iconName: string;
        disabled: boolean;
        handleClick: () => void;
      }
  )[] = $state([]);

  let commandOpen = $state(false);

  $effect(() => {
    if (typeof window === "undefined") return;

    const handleKeydown = (e: KeyboardEvent) => {
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

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  });

  // Lifecycles
  // for now
  $effect(() => {
    if (mediaUrl && player && mediaUrl != player?.source()) {
      player?.source(mediaUrl);
    }

    /** Set tool to visual mode when video is playing & mode is not visual */
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
        type: IDAH_VIDEO_POLYGON,
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

    annotationsIndexedDB(["idah-video", "entry", entryId].join(":")).then((idb) => {
      annotationsIDB = idb;
      fetchAnnotations(idb).then(() => {
        // quick fix if unsynced data, though we dont have way to send it anyway for now if so
        idb?.getAllIndex("type", ENTRY_ROOT).then((anns) => ($entryRoot = anns[0]));
      });
    }, console.error);

    function fetchAnnotations(db: AnnotationsIndexedDB, page = 1, itemsPerPage = 100): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        context.annotations.list({ entry_id: entryId }, { page, itemsPerPage }).then((res) => {
          let d = res.map((ann) => {
            const annotation: VideoAnnotationObject = {
              shape: {
                ...(ann.dimensions as VideoShape),
                range: [ann.dimensions.start, ann.dimensions.end],
              },
              value: {
                ...ann.annotation,
                category: ann.annotation.category || "null",
              },
              metadata: {
                id: ann.id,
                updatedAt: ann.updated_at || new Date(),
                createdAt: ann.created_at || new Date(),
                metadata: ann.metadata || {},
              },
              hidden: false,
              locked: false,
              synced: true,
            };
            if (annotation.shape.type == ENTRY_ROOT) $entryRoot = annotation;
            return annotation;
          });

          if (d.length) {
            db.upsertAnnotations(d).then(() => {
              $idbUpdatedAt = new Date();
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
          case IDAH_VIDEO_POLYGON:
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

  async function runCreateAnnotation(annotationId: string, newAnnotation: VideoAnnotationObject) {
    setSelectedAnnotation(newAnnotation);
    await annotationsIDB?.upsertAnnotations([newAnnotation]);
    $entryRoot = newAnnotation.shape.type == ENTRY_ROOT ? newAnnotation : undefined;

    // Create new annotation and set it synced
    context.annotations.create(annotationId, newAnnotation.shape, newAnnotation.value).then(async () => {
      const ann = await annotationsIDB?.get("annotations", annotationId);

      if (ann && ann.metadata.updatedAt.valueOf() == newAnnotation.metadata.createdAt.valueOf()) {
        ann.synced = true;
        setSelectedAnnotation(ann);
        await annotationsIDB?.upsertAnnotations([ann]);
        $entryRoot = newAnnotation.shape.type == ENTRY_ROOT ? newAnnotation : undefined;
      }
    });
  }

  async function runDeleteAnnotation(annotationId: string) {
    /** Deselect annotation if annotation is selected */
    if ($selectedAnnotation?.metadata.id == annotationId) deselectAnnotation();
    /** Deselect entry root annotation */
    if ($entryRoot?.metadata.id == annotationId) $entryRoot = undefined;

    await annotationsIDB?.deleteAnnotation(annotationId);
    context.annotations.delete(annotationId);
  }

  // need to store dependancy and extract thos commands definitions
  context.commands.on("annotation.add", (props: { shape: VideoShape; value: AnnotationValue }) => {
    const { shape, value } = props;
    const uuid = uuidv7(); // for now move to annotation driver create asap

    return {
      name: "new annotation",
      async apply() {
        const createdAt = new Date();
        const newAnnotation: VideoAnnotationObject = {
          shape: shape,
          value: value,
          metadata: {
            id: uuid,
            createdAt,
            updatedAt: createdAt,
          },
          synced: false,
          locked: false,
          hidden: false,
        };

        runCreateAnnotation(uuid, newAnnotation);
        $idbUpdatedAt = new Date();
      },
      async undo() {
        runDeleteAnnotation(uuid);
        $idbUpdatedAt = new Date();
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("annotation.delete", async (props: { annotationId: string }) => {
    const { annotationId } = props;
    const ann = await annotationsIDB?.get("annotations", annotationId);
    if (!ann) return showToast.error({ title: "cannot remove not found annotation" });

    return {
      name: "remove annotation",
      async apply() {
        runDeleteAnnotation(annotationId);
        $idbUpdatedAt = new Date();
      },
      async undo() {
        const createdAt = new Date();
        let newAnnotation = {
          ...ann,
          metadata: {
            ...ann.metadata,
            createdAt,
            updatedAt: createdAt,
            metadata: {
              group_id: ann.metadata.metadata?.group_id,
              parent_id: ann.metadata.metadata?.parent_id,
            },
          },
          synced: false,
          locked: false,
          hidden: false,
        };

        runCreateAnnotation(annotationId, newAnnotation);
        $idbUpdatedAt = new Date();
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("annotation.deleteGroup", async (props: { groupId: string }) => {
    const { groupId } = props;
    const annotations = await annotationsIDB?.getGroupAnnotations(groupId);
    if (!annotations || annotations.length === 0) {
      showToast.error({ title: "cannot remove not found annotation group" });
      return;
    }

    return {
      name: "remove annotation group",
      async apply() {
        for (const annotation of annotations) {
          const annotationId = annotation.metadata.id;
          runDeleteAnnotation(annotationId);
        }
        $idbUpdatedAt = new Date();
      },
      async undo() {
        const createdAt = new Date();
        for (const annotation of annotations) {
          const annotationId = annotation.metadata.id;
          let newAnnotation = {
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

          runCreateAnnotation(annotationId, newAnnotation);
          $idbUpdatedAt = new Date();
        }
        $idbUpdatedAt = new Date();
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
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

        $selectedAnnotation = v;

        await annotationsIDB?.upsertAnnotations([v]);
        $idbUpdatedAt = new Date();

        let p = context.annotations.update({
          id: v.metadata.id,
          dimensions: v.shape,
          annotation: v.value,
        });

        p.then(async () => {
          const v = await annotationsIDB?.get("annotations", props.id);
          if (v && v?.metadata.updatedAt.valueOf() == updatedAt.valueOf()) {
            v.synced = true;
            await annotationsIDB?.upsertAnnotations([v]);
            $selectedAnnotation = v;
            $idbUpdatedAt = new Date();
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
        await annotationsIDB?.upsertAnnotations([v]);
        $selectedAnnotation = v;
        $idbUpdatedAt = new Date();

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
            await annotationsIDB?.upsertAnnotations([v]);
            $selectedAnnotation = v;
            $idbUpdatedAt = new Date();
          }
        });
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("keyframe.delete", async (props: { annotationId: string; frame: number }) => {
    const annotation = await annotationsIDB?.get("annotations", props.annotationId);

    if (!annotation)
      return showToast.error({
        title: "cannot remove selection, annotation not found",
      });

    let index = annotation.shape.frames.findIndex((v: VideoFrameSelection) => v.frame == props.frame);
    if (index == -1) return showToast.warning({ title: "No frame to remove" });

    let selection = annotation.shape.frames[index];

    return {
      name: "delete bounding box keyframe",
      async apply() {
        const updatedAt = new Date();
        const annotation = await annotationsIDB?.get("annotations", props.annotationId);

        if (!annotation)
          return showToast.error({
            title: "cannot remove keyframe, annotation not found",
          });

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
        await annotationsIDB?.upsertAnnotations([annotation]);
        $idbUpdatedAt = new Date();

        $selectedAnnotation = annotation;

        let p = context.annotations.update({
          id: annotation.metadata.id,
          dimensions: annotation.shape,
          annotation: annotation.value,
        });

        p.then(async () => {
          const annotation = await annotationsIDB?.get("annotations", props.annotationId);
          if (annotation && annotation?.metadata.updatedAt.valueOf() == updatedAt.valueOf()) {
            annotation.synced = true;
            await annotationsIDB?.upsertAnnotations([annotation]);
            $selectedAnnotation = annotation;
            $idbUpdatedAt = new Date();
          }
        });
      },
      async undo() {
        const updatedAt = new Date();
        let annotation = await annotationsIDB?.get("annotations", props.annotationId);

        if (!annotation)
          return showToast.error({
            title: "cannot undo remove selection, annotation not found",
          });

        let newframes = [...annotation.shape.frames.filter((v) => v.frame != props.frame), selection];
        annotation.shape = {
          start: newframes.reduce((acc, v) => (v.frame <= acc || acc == -1 ? v.frame : acc), -1),
          end: newframes.reduce((acc, v) => (v.frame >= acc || acc == -1 ? v.frame : acc), -1),
          type: annotation.shape.type,
          frames: newframes,
        };
        annotation.metadata.updatedAt = updatedAt;
        annotation.synced = false;
        $selectedAnnotation = annotation;

        await annotationsIDB?.addKeyFrame(annotation, selection);
        $idbUpdatedAt = new Date();

        let p = context.annotations.update({
          id: annotation.metadata.id,
          dimensions: annotation.shape,
          annotation: annotation.value,
        });

        p.then(async () => {
          const annotation = await annotationsIDB?.get("annotations", props.annotationId);
          if (annotation && annotation?.metadata.updatedAt.valueOf() == updatedAt.valueOf()) {
            annotation.synced = true;
            await annotationsIDB?.upsertAnnotations([annotation]);
            $selectedAnnotation = annotation;
            $idbUpdatedAt = new Date();
          }
        });
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("annotation.update", (props: { annotation: VideoAnnotationObject; value: AnnotationValue }) => {
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
          annotation.metadata.metadata = props.annotation.metadata.metadata;
          annotation.synced = false;
          $selectedAnnotation = annotation;

          await annotationsIDB?.upsertAnnotations([annotation]);
          $idbUpdatedAt = new Date();

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
              $selectedAnnotation = annotation;
              if ($entryRoot?.metadata.id == annotation.metadata.id) $entryRoot = annotation;
              await annotationsIDB?.upsertAnnotations([annotation]);
              $idbUpdatedAt = new Date();
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

          $selectedAnnotation = annotation;

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
              $selectedAnnotation = annotation;
              if ($entryRoot?.metadata.id == annotation.metadata.id) $entryRoot = annotation;
              await annotationsIDB?.upsertAnnotations([annotation]);
              $idbUpdatedAt = new Date();
            }
          });
        }
      },
      isCombinable: () => false,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on(
    "annotation.updateGroupCategory",
    async (props: { groupId: string; categoryIdToBeUpdate: string }) => {
      const { groupId, categoryIdToBeUpdate } = props;
      const annotations = await annotationsIDB?.getGroupAnnotations(groupId);
      let beforeUpdateCategoryId: string | undefined = undefined;

      if (!annotations || annotations.length === 0) {
        showErrorToast({ title: "Not found annotation group to update" });
        return;
      }

      return {
        name: "update annotation group",
        async apply() {
          for (const annotation of annotations) {
            beforeUpdateCategoryId = annotation.value.category;
            const newUpdatedAt = new Date();

            annotation.value = { category: categoryIdToBeUpdate };
            annotation.metadata.updatedAt = newUpdatedAt;
            annotation.synced = false;

            /** Upsert to IndexDB */
            await annotationsIDB?.upsertAnnotations([annotation]);

            /** Update to Database */
            const promiseToUpdate = context.annotations.update({
              id: annotation.metadata.id,
              dimensions: annotation.shape,
              annotation: { category: categoryIdToBeUpdate },
            });

            promiseToUpdate.then(async () => {
              const ann = await annotationsIDB?.get("annotations", annotation.metadata.id);
              if (ann && ann.metadata.updatedAt.valueOf() == newUpdatedAt.valueOf()) {
                ann.synced = true;
                await annotationsIDB?.upsertAnnotations([ann]);

                /** Refetch */
                annotationValue = { category: categoryIdToBeUpdate };
                $idbUpdatedAt = new Date();
              }
            });
          }
        },
        async undo() {
          const undoAt = new Date();
          for (const annotationToBeUndo of annotations) {
            annotationToBeUndo.value = { category: beforeUpdateCategoryId };
            annotationToBeUndo.metadata.updatedAt = undoAt;
            annotationToBeUndo.synced = false;

            /** Upsert to IndexDB */
            await annotationsIDB?.upsertAnnotations([annotationToBeUndo]);

            /** Update to Database */
            const promiseToUndo = context.annotations.update({
              id: annotationToBeUndo.metadata.id,
              dimensions: annotationToBeUndo.shape,
              annotation: { category: beforeUpdateCategoryId },
            });

            promiseToUndo.then(async () => {
              const ann = await annotationsIDB?.get("annotations", annotationToBeUndo.metadata.id);
              if (ann && ann.metadata.updatedAt.valueOf() == undoAt.valueOf()) {
                annotationToBeUndo.synced = true;
                await annotationsIDB?.upsertAnnotations([annotationToBeUndo]);

                /** Refetch */
                annotationValue = { category: beforeUpdateCategoryId };
                $idbUpdatedAt = new Date();
              }
            });
          }
        },
        isCombinable: () => false,
        combine: (prevCmd) => prevCmd,
      };
    },
  );

  context.commands.on("annotation.toggleHidden", async (props: { id: string }) => {
    const annotation = await annotationsIDB?.get("annotations", props.id);

    if (!annotation)
      return showToast.error({
        title: "cannot toggle hidden, annotation not found",
      });

    const wasHidden = annotation.hidden;

    return {
      name: "toggle hidden",
      apply: () => onVisibility(!wasHidden, annotation),
      undo: () => onVisibility(wasHidden, annotation),
      isCombinable: () => true,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("annotation.toggleLocked", async (props: { id: string }) => {
    const annotation = await annotationsIDB?.get("annotations", props.id);

    if (!annotation)
      return showToast.error({
        title: "cannot toggle locked, annotation not found",
      });

    const wasLocked = annotation.locked;

    return {
      name: "toggle locked",
      apply: () => onLock(!wasLocked, annotation),
      undo: () => onLock(wasLocked, annotation),
      isCombinable: () => true,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("annotation.split", async (props: { id: string; at: number }) => {
    const annotation = await annotationsIDB?.get("annotations", props.id);

    if (!annotation)
      return showToast.error({
        title: "cannot split annotation, annotation not found",
      });

    const splitAt = props.at;

    if (annotation.shape.start >= splitAt) return console.log("cannot split before/at start frame");
    if (annotation.shape.end < splitAt) return console.log("cannot split after end frame");

    const newId = uuidv7();
    const createdAt = new Date();

    // original annotation data, prepare for undoing
    const originalEnd = annotation.shape.end;
    const originalFrames = annotation.shape.frames;
    const originalUpdatedAt = annotation.metadata.updatedAt;
    const originalGroupId = annotation.metadata.metadata?.group_id;

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

    const groupId = originalGroupId || annotation.metadata.id;

    return {
      name: "split annotation",
      async apply() {
        // Update Part 1
        const a1 = await annotationsIDB?.get("annotations", props.id);
        if (a1) {
          a1.shape.end = part1End;
          a1.shape.frames = part1Frames;
          a1.metadata.updatedAt = createdAt;
          a1.metadata.metadata = {
            ...annotation.metadata.metadata,
            group_id: groupId,
          };
          a1.synced = false;
          await annotationsIDB?.upsertAnnotations([a1]);
          // context update
          let p = context.annotations.update({
            id: a1.metadata.id,
            dimensions: a1.shape,
            annotation: a1.value,
            metadata: a1.metadata.metadata,
          });

          p.then(async () => {
            const annotation = await annotationsIDB?.get("annotations", props.id);
            if (annotation && annotation.metadata.updatedAt.valueOf() == createdAt.valueOf()) {
              annotation.synced = true;
              if ($entryRoot?.metadata.id == annotation.metadata.id) $entryRoot = annotation;
              await annotationsIDB?.upsertAnnotations([annotation]);
              $idbUpdatedAt = new Date();
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
            metadata: {
              group_id: groupId,
              parent_id: annotation.metadata.id,
            },
          },
          synced: false,
          locked: false,
          hidden: false,
        };

        if (a2.shape.type == ENTRY_ROOT) $entryRoot = a2;

        await annotationsIDB?.upsertAnnotations([a2]);
        $idbUpdatedAt = new Date();

        let p2 = context.annotations.create(newId, a2.shape, a2.value, a2.metadata.metadata);
        p2.then(async () => {
          const annotation = await annotationsIDB?.get("annotations", newId);
          if (annotation && annotation.metadata.updatedAt.valueOf() == createdAt.valueOf()) {
            annotation.synced = true;
            if ($entryRoot?.metadata.id == annotation.metadata.id) $entryRoot = annotation;
            await annotationsIDB?.upsertAnnotations([annotation]);
            $idbUpdatedAt = new Date();
            $selectedAnnotation = annotation;
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

          if (originalGroupId === undefined) {
            delete a1.metadata.metadata?.group_id;
          } else {
            if (!a1.metadata.metadata) a1.metadata.metadata = {};
            a1.metadata.metadata.group_id = originalGroupId;
          }

          a1.synced = false;
          await annotationsIDB?.upsertAnnotations([a1]);

          let p = context.annotations.update({
            id: a1.metadata.id,
            dimensions: a1.shape,
            annotation: a1.value,
            metadata: a1.metadata.metadata,
          });

          p.then(async () => {
            const annotation = await annotationsIDB?.get("annotations", props.id);
            // verify using originalUpdatedAt
            if (annotation && annotation.metadata.updatedAt.valueOf() == originalUpdatedAt.valueOf()) {
              annotation.synced = true;
              if ($entryRoot?.metadata.id == annotation.metadata.id) $entryRoot = annotation;
              await annotationsIDB?.upsertAnnotations([annotation]);
              $idbUpdatedAt = new Date();
              $selectedAnnotation = annotation;
            }
          });
        }

        // delete part 2
        await annotationsIDB?.deleteAnnotation(newId);
        $idbUpdatedAt = new Date();
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
        deselectAnnotation();
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("tools.bounding_box", () => {
    return {
      name: "bounding box tool",
      apply: () => {
        mode = IDAH_VIDEO_BOUNDING_BOX;
        deselectAnnotation();
        deselectAnnotationGroup();
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("tools.note", () => {
    return {
      name: "note tool",
      apply: () => {
        mode = IDAH_NOTE;
        deselectAnnotation();
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("tools.reset", () => {
    return {
      name: "reset tool",
      apply: () => {
        mode = DEFAULT_MODE;
        deselectAnnotation();
        deselectAnnotationGroup();
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (prevCmd) => prevCmd,
    };
  });

  context.commands.on("tools.polygon", () => {
    return {
      name: "polygon tool",
      apply: () => {
        mode = IDAH_VIDEO_POLYGON;
        deselectAnnotation();
        deselectAnnotationGroup();
      },
      undo: () => {},
      isCombinable: () => true,
      combine: (prevCmd) => prevCmd,
    };
  });

  function addAnnotation(shape: AnnotationShape, value: AnnotationValue = {}) {
    if (!["review", "annotate"].includes(context.workflowStep)) return;
    const videoShape: VideoShape = {
      // filter out indexed shape index noise for now
      shape: Object.fromEntries(
        Object.entries(shape).filter(([k, _]) => ["type", "frames", "start", "end"].includes(k)),
      ),
      value,
    };

    context.commands.run("annotation.add", videoShape);
  }

  async function removeAnnotation(annotationId: string) {
    if (!["review", "annotate"].includes(context.workflowStep)) return;

    context.commands.run("annotation.delete", { annotationId });
  }

  async function addSelection(id: string, selection: VideoFrameSelection) {
    if (!["review", "annotate"].includes(context.workflowStep)) return;

    context.commands.run("keyframe.add", { id, selection });
  }

  async function deleteSelection(annotationId: string, frame: number) {
    if (!["review", "annotate"].includes(context.workflowStep)) return;

    context.commands.run("keyframe.delete", { annotationId, frame });
  }

  function onDeleteAnnotation(annotation: VideoAnnotationObject, frame?: number) {
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
    if (valueMode == ENTRY_ROOT && !$selectedAnnotation && $entryRoot?.metadata.id) $selectedAnnotation = $entryRoot;

    // wait for confirmation
    if (showPopOver) {
      if ($selectedAnnotation)
        $selectedAnnotation = {
          ...$selectedAnnotation,
          value: annotationValue,
        };
    } else {
      if (valueMode == ENTRY_ROOT && !$selectedAnnotation) {
        if (value.category && value.category != "" && requirementFullfilled)
          addAnnotation({ type: valueMode }, $state.snapshot(value));
      } else if ($selectedAnnotation) {
        $selectedAnnotation = {
          ...$selectedAnnotation,
          value: annotationValue,
        };
        if (requirementFullfilled) updateAnnotationValue($state.snapshot($selectedAnnotation), $state.snapshot(value));
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
      /**
       * If no selectedId, check if we have an active group selection.
       * If yes, we try to find the closest annotation in that group to add a keyframe to.
       */
      if ($selectedAnnotationGroup) {
        const closest = selectClosestAnnotation($selectedAnnotationGroup, frame);
        addSelection(closest.metadata.id, { frame, angle, points });
        return;
      }

      let annotation_value_from = $state.snapshot(annotationValue) as AnnotationValue;

      // todo proper validation
      let shape: AnnotationShape = { type };
      switch (type) {
        case DEFAULT_MODE:
          break;
        case IDAH_VIDEO_BOUNDING_BOX:
          shape = {
            ...shape,
            start: frame,
            end: frame,
            frames: [{ frame, angle, points }],
          };
          break;
        case IDAH_VIDEO_POLYGON:
          shape = {
            ...shape,
            start: frame,
            end: frame,
            frames: [{ frame, points }],
          };
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

  function updateAnnotationValue(annotation: VideoAnnotationObject, value: AnnotationValue) {
    if (annotation?.locked || !["review", "annotate"].includes(context.workflowStep)) return;

    context.commands.run("annotation.update", { annotation, value });
  }

  function selectAnnotation(annotation?: VideoAnnotationObject) {
    $selectedAnnotation = annotation;

    /**
     * Set mode to the annotation shape type when selecting an annotation
     */
    if (mode === "note") {
      return;
    } else if (annotation?.shape.type && ["review", "annotate"].includes(context.workflowStep)) {
      mode = annotation.shape.type;
      // Register selection-specific shortcuts for the current mode
      registerOnSelectBoxModeShortcuts(
        context,
        annotation.metadata.id,
        annotation.metadata.metadata?.group_id,
        () => currentFrame,
      );
    } else {
      mode = DEFAULT_MODE;
    }
    if ($selectedAnnotation) {
      $selectedAnnotationGroup = {
        groupId: $selectedAnnotation.metadata.metadata?.group_id || $selectedAnnotation.metadata.id,
        annotations: [$selectedAnnotation],
      };
    }
  }

  // TODO: refactor with selectAnnotation ?
  function selectAnnotationGroup(annotationGroup: AnnotationGroup<VideoAnnotationObject>, selectedFrame?: number) {
    $selectedAnnotationGroup = annotationGroup;

    const firstAnnotation = annotationGroup.annotations[0];
    /**
     * Set mode to the annotation shape type when selecting an annotation
     */
    if (mode === "note") {
      return;
    } else if (selectedFrame && firstAnnotation.shape.type && ["review", "annotate"].includes(context.workflowStep)) {
      /**
       * If user select timeline row at specific frame (selectedFrame is exists)
       * and workflow step is in review or annotation
       */
      mode = firstAnnotation.shape.type;
      selectClosestAnnotation(annotationGroup, selectedFrame);
      // Register selection-specific shortcuts for the current mode
      registerOnSelectBoxModeShortcuts(context, undefined, annotationGroup.groupId, () => currentFrame);
    } else {
      selectAnnotation(undefined);
      mode = DEFAULT_MODE;
    }
  }

  function selectClosestAnnotation(annotationGroup: AnnotationGroup<VideoAnnotationObject>, frame: number) {
    let closestAnnotation = annotationGroup.annotations[0];

    if (annotationGroup.annotations.length === 1) {
      selectAnnotation(closestAnnotation);
      return closestAnnotation;
    }

    let minDiff = Infinity;

    for (const annotation of annotationGroup.annotations) {
      const start = annotation.shape.start;
      const end = annotation.shape.end;

      // If frame is within an annotation, that's the one
      if (frame >= start && frame <= end) {
        closestAnnotation = annotation;
        minDiff = 0;
        break;
      }

      // Calculate distance to nearest edge
      const diff = Math.min(Math.abs(frame - start), Math.abs(frame - end));

      if (diff < minDiff) {
        minDiff = diff;
        closestAnnotation = annotation;
      }
    }

    if (closestAnnotation) {
      mode = closestAnnotation.shape.type;
      selectAnnotation(closestAnnotation);
    }

    return closestAnnotation;
  }

  let overlay: SvgOverlay;

  let annotations_promise: Promise<VideoAnnotationObject[]> = $derived.by(() => {
    $idbUpdatedAt; // eslint-disable-line @typescript-eslint/no-unused-expressions

    if (!annotationsIDB) return new Promise((_, ko) => ko("no database"));

    let p = annotationsIDB.getAllStore("annotations");

    p.then((updatedAnnotations) => {
      $boundingBoxes = updatedAnnotations;
    });

    return p;
  });

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

  function onVisibility(hidden: boolean, annotation?: VideoAnnotationObject) {
    if (annotation) {
      annotation.hidden = hidden;
      if (annotation.metadata.id == $selectedAnnotation?.metadata.id) $selectedAnnotation.hidden = hidden;
      if (annotation.shape.type == ENTRY_ROOT) $entryRoot = annotation;

      annotationsIDB?.upsertAnnotations([annotation]).then(() => ($idbUpdatedAt = new Date()));
    } else {
      allHidden = hidden;
      if ($selectedAnnotation) $selectedAnnotation.hidden = hidden;
      annotationsIDB?.updateAllVisibility(hidden).then(() => ($idbUpdatedAt = new Date()));
    }
  }

  function onLock(locked: boolean, annotation?: VideoAnnotationObject) {
    if (annotation) {
      annotation.locked = locked;
      if (annotation.metadata.id == $selectedAnnotation?.metadata.id) $selectedAnnotation.locked = locked;
      if (annotation.shape.type == ENTRY_ROOT) $entryRoot = annotation;
      annotationsIDB?.upsertAnnotations([annotation]).then(() => ($idbUpdatedAt = new Date()));
    } else {
      allLocked = locked;
      if ($entryRoot) $entryRoot.locked = locked;
      if ($selectedAnnotation) $selectedAnnotation.locked = locked;
      annotationsIDB?.updateAllLock(locked).then(() => ($idbUpdatedAt = new Date()));
    }
  }

  // Helper function to normalize interpolated points to Point[]
  function normalizePoints(points: Point[] | InterpolatedVertex[] | undefined): Point[] | undefined {
    if (!points) return undefined;
    // Check if first element is InterpolatedVertex by checking if it has a 'point' property
    if (points.length > 0 && typeof points[0] === "object" && "point" in points[0]) {
      return (points as InterpolatedVertex[]).map((item) => item.point);
    }
    return points as Point[];
  }

  async function onReSelectCategory(reselectedCategoryId: string) {
    if (!$selectedAnnotationGroup) return;

    /** Update annotation group category */
    context.commands.run("annotation.updateGroupCategory", {
      groupId: $selectedAnnotationGroup.groupId,
      categoryIdToBeUpdate: reselectedCategoryId,
    });
  }

  let allHidden: boolean = $state(false);
  let allLocked: boolean = $state(false);
</script>

<div class="relative flex h-full w-full flex-col">
  {#key [ShortcutManager, ShortcutManager.currentMode, ShortcutManager.getCurrentMode(), $selectedAnnotation]}
    <CommandDialog bind:open={commandOpen} accesskey={ShortcutManager.getCurrentMode()}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading={`MODE: ${ShortcutManager.getCurrentMode()}`}>
          {#each Object.entries(ShortcutManager.getEffectiveKeyMap(mode) || {}) as [key, value] (key)}
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

    <PopoverContent class="min-w-80 p-0">
      <div class="h-auto max-h-86 overflow-y-auto p-2">
        {#if annotationValue.category}
          <CategoryProperties
            {mode}
            selectedCategory={annotationValue.category}
            {annotationValue}
            onSelectCategory={(selectedCategory) => {
              if (!selectedCategory) selectAnnotation();
              annotationValue = {
                ...annotationValue,
                category: selectedCategory,
              };
              onEditValue({ category: annotationValue.category }, mode);
            }}
            onEditValue={(value) => value && onEditValue(value, mode)}
            disabled={false}
          />
        {:else}
          <AnnotationSidebar
            view="popover"
            sidebarWidthRem={annotationSidebarWidthRem}
            class="rounded-t-lg"
            db={annotationsIDB}
            {annotationValue}
            {currentFrame}
            {onEditValue}
            onSelectAnnotation={selectAnnotation}
            onSelectAnnotationGroup={() => {}}
            {onDeleteAnnotation}
            {onLock}
            {onVisibility}
            {context}
            {mode}
          />
        {/if}
      </div>

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
              view="sidebar"
              sidebarWidthRem={annotationSidebarWidthRem}
              db={annotationsIDB}
              {annotationValue}
              {currentFrame}
              {onEditValue}
              onSelectAnnotation={selectAnnotation}
              onSelectAnnotationGroup={selectAnnotationGroup}
              {onDeleteAnnotation}
              {onLock}
              {onVisibility}
              {context}
              {mode}
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
                  }}
                  onVolumeChange={(level, muted) => (volume = { level, muted })}
                />
              </SvgOverlay>

              <PropertiesSidebar {annotationId} {annotationValue} {onEditValue} {onReSelectCategory} {context} {mode} />
            </section>
          </ResizablePane>
        </ResizablePaneGroup>
      </ResizablePane>

      <ResizableHandle withHandle />

      <ResizablePane defaultSize={25} minSize={15}>
        <AnnotationFooter>
          <AnnotationFooterToolbar>
            <VideoController
              {isPlaying}
              {zoom}
              {currentFrame}
              {totalFrames}
              {volume}
              bind:video={player}
              onZoomChange={(z) => timelineTable.setZoom(z)}
            />
          </AnnotationFooterToolbar>

          <ScrollArea class="h-[calc(100%-3rem)]">
            <TimelineTable
              bind:this={timelineTable}
              {annotations_promise}
              {scale}
              {zoom}
              {currentFrame}
              {totalFrames}
              onSeekFrame={seekToFrame}
              {onDeleteAnnotation}
              {onLock}
              {onVisibility}
              {allHidden}
              {allLocked}
              onSelectAnnotation={selectAnnotation}
              onSelectGroupAtFrame={selectAnnotationGroup}
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
