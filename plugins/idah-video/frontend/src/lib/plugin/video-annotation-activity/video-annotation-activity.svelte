<script lang="ts">
  import { onMount, setContext } from "svelte";

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

  import { ShortcutManager } from "$idah/shortcut/shortcut-manager";

  import { DEFAULT_MODE, ENTRY_ROOT, IDAH_NOTE, IDAH_VIDEO_BOUNDING_BOX, IDAH_VIDEO_POLYGON } from "$lib/plugin/type";
  import { requiredFullfilled } from "$lib/plugin/video-annotation-activity/category-properties";
  import { registerCommands } from "$lib/plugin/video-annotation-activity/commands.svelte";
  import { annotationsIndexedDB, AnnotationsIndexedDB } from "$lib/plugin/video-annotation-activity/indexedDB";
  import {
    registerOnSelectBoxModeShortcuts,
    registerVisualModeShortcuts,
  } from "$lib/plugin/video-annotation-activity/shortcut";
  import {
    boundingBoxes,
    entryRoot,
    idbUpdatedAt,
    setIndexedDBUpdatedAt,
  } from "$lib/plugin/video-annotation-activity/store/idb-store.svelte";
  import {
    currentFrame,
    currentMode,
    selectedAnnotation,
    selectedAnnotationGroup,
    setCurrentFrame,
    setCurrentModeTo,
    setSelectedAnnotation,
    setSelectedAnnotationGroup,
    setTotalFrames,
  } from "$lib/plugin/video-annotation-activity/store/store";

  import AnnotationFooterToolbar from "$lib/plugin/layout/footer/annotation-footer-toolbar.svelte";
  import AnnotationFooter from "$lib/plugin/layout/footer/annotation-footer.svelte";
  import AnnotationSidebar from "$lib/plugin/layout/sidebar/annotation-sidebar.svelte";
  import PropertiesSidebar from "$lib/plugin/layout/sidebar/properties-sidebar.svelte";
  import CategoryProperties from "$lib/plugin/video-annotation-activity/category-properties/category-properties.svelte";
  import SvgOverlay, { type OnAddNewNoteParams } from "$lib/plugin/video-annotation-activity/svg-overlay.svelte";
  import TimelineController from "$lib/plugin/video-annotation-activity/timeline/timeline-controller.svelte";
  import Timeline from "$lib/plugin/video-annotation-activity/timeline/timeline.svelte";
  import VideoController from "$lib/plugin/video-annotation-activity/video/video-controller.svelte";
  import Video from "$lib/plugin/video-annotation-activity/video/video.svelte";

  import {
    type InterpolatedVertex,
    type Point,
    type VideoAnnotationObject,
    type VideoFrameSelection,
    type VideoShape,
  } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

  import type { IActivityContext } from "$idah/context/activity-context";
  import type { AnnotationGroup, AnnotationShape, AnnotationValue } from "$idah/context/annotation-context";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();

  // Contexts
  setContext("context", context);

  // Variables
  const editableWorkflowSteps = ["annotate", "review"];
  const notableWorkflowSteps = ["annotate", "review", "done"];

  let { id: entryId, mediaUrl, workflowStep } = $derived(context);
  let editable = $derived<boolean>(editableWorkflowSteps.includes(workflowStep));
  let notable = $derived<boolean>(notableWorkflowSteps.includes(workflowStep));
  let isNoteMode = $derived($currentMode === IDAH_NOTE);

  let player: Video | undefined = $state();
  let player_container: HTMLDivElement | undefined = $state();

  let annotationSidebarResizablePercentage = $state<number>(16);
  let annotationSidebarWidthRem = $derived<number>(annotationSidebarResizablePercentage + 3);

  let annotationId = $derived<string | undefined>($selectedAnnotation ? $selectedAnnotation.metadata.id : undefined);
  let annotationValue: AnnotationValue = $derived($selectedAnnotation?.value || {});

  // Variables::Timeline
  let zoom = $state(85);
  let scale = $state(1);

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

  let allHidden: boolean = $state(false);
  let allLocked: boolean = $state(false);

  let overlay: SvgOverlay;
  let showPopOver = $state(false);
  let videoResizedAt = $state(new Date());

  let setVisibility: (hidden: boolean, annotation?: VideoAnnotationObject) => void = $state(() => {});
  let setEditability: (locked: boolean, annotation?: VideoAnnotationObject) => void = $state(() => {});

  $effect(() => {
    if (typeof window === "undefined") return;

    const handleKeydown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
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
  $effect(() => {
    if (mediaUrl && player && mediaUrl != player?.source()) {
      player?.source(mediaUrl);
    }

    /** Set tool to visual mode when video is playing & mode is not visual */
    if (isPlaying && $currentMode !== DEFAULT_MODE) {
      context.commands.run("tools.visual");
    }
  });

  onMount(async () => {
    $boundingBoxes = [];

    /** REGISTER TOOLS */
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
        disabled: !editable,
        handleClick: () => context.commands.run("tools.bounding_box"),
      },
      {
        label: "Polygon",
        type: IDAH_VIDEO_POLYGON,
        iconName: "polygon",
        disabled: !editable,
        handleClick: () => context.commands.run("tools.polygon"),
      },
      {
        label: "Notes",
        type: IDAH_NOTE,
        iconName: "message-circle",
        disabled: !notable, // Note: Only allow to create note when workflow steps are "annotate" and "review"
        handleClick: () => context.commands.run("tools.note"),
      },
    ];
    context.tools.setTools(tools);
    $effect(() => context.tools.setTool($currentMode));

    annotationsIndexedDB(["idah-video", "entry", entryId].join(":")).then((idb) => {
      annotationsIDB = idb;
      fetchAnnotations(idb).then(() => {
        // quick fix if unsynced data, though we dont have way to send it anyway for now if so
        idb?.getAllIndex("type", ENTRY_ROOT).then((anns) => ($entryRoot = anns[0]));

        /** Register commands */
        const commands = registerCommands({
          context,
          getDb: () => annotationsIDB,
          updaters: {
            setAllHidden: (v) => (allHidden = v),
            setAllLocked: (v) => (allLocked = v),
            setAnnotationValue: (v) => (annotationValue = v),
          },
        });
        setVisibility = commands.setVisibility;
        setEditability = commands.setEditability;
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
              setIndexedDBUpdatedAt();
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

  function seekToFrame(frame: number) {
    player?.seekToFrame(frame);
  }

  function addAnnotation(shape: AnnotationShape, value: AnnotationValue = {}) {
    if (!editable) return;

    const { type, start, end, frames } = shape;
    const videoShape: VideoShape = { type, start, end, frames, value };

    context.commands.run("annotation.add", { shape: videoShape, value });
  }

  async function removeAnnotation(annotationId: string) {
    if (!editable) return;

    context.commands.run("annotation.delete", { annotationId });
  }

  async function addSelection(id: string, selection: VideoFrameSelection) {
    if (!editable) return;

    context.commands.run("keyframe.add", { id, selection });
  }

  async function deleteSelection(annotationId: string, frame: number) {
    if (!editable) return;

    context.commands.run("keyframe.delete", { annotationId, frame });
  }

  function deleteAnnotation(annotation: VideoAnnotationObject, frame?: number) {
    if (!editable) return;

    if (frame != undefined) {
      deleteSelection(annotation.metadata.id, frame);
    } else {
      removeAnnotation(annotation.metadata.id);
    }
  }

  let shapeSelectionArgs:
    | [type: string, frame: number, _points: Point[], angle: number, selectedId?: string]
    | undefined = $state();

  function onEditValue(value: AnnotationValue, valueMode: string) {
    if (!editable) return;

    let requirementFullfilled = requiredFullfilled(value, context.config[valueMode]?.properties);
    annotationValue = value;
    setCurrentModeTo(valueMode);
    if (valueMode == ENTRY_ROOT && !$selectedAnnotation && $entryRoot?.metadata.id) setSelectedAnnotation($entryRoot);

    // wait for confirmation
    if (showPopOver) {
      if ($selectedAnnotation)
        setSelectedAnnotation({
          ...$selectedAnnotation,
          value: annotationValue,
        });
    } else {
      if (valueMode == ENTRY_ROOT && !$selectedAnnotation) {
        if (value.category && value.category != "" && requirementFullfilled)
          addAnnotation({ type: valueMode }, $state.snapshot(value));
      } else if ($selectedAnnotation) {
        setSelectedAnnotation({
          ...$selectedAnnotation,
          value: annotationValue,
        });
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
    if (!editable || isNoteMode) return;

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
    if (annotation?.locked || !editable) return;

    context.commands.run("annotation.update", { annotation, value });
  }

  function selectAnnotation(annotation?: VideoAnnotationObject) {
    setSelectedAnnotation(annotation);

    /**
     * Set mode to the annotation shape type when selecting an annotation
     */
    if (isNoteMode) {
      return;
    } else if (annotation?.shape.type && editable) {
      setCurrentModeTo(annotation.shape.type);
      // Register selection-specific shortcuts for the current mode
      registerOnSelectBoxModeShortcuts(
        context,
        annotation.metadata.id,
        annotation.metadata.metadata?.group_id,
        () => $currentFrame,
      );
    } else {
      setCurrentModeTo(DEFAULT_MODE);
    }
    if ($selectedAnnotation) {
      setSelectedAnnotationGroup({
        groupId: $selectedAnnotation.metadata.metadata?.group_id || $selectedAnnotation.metadata.id,
        annotations: [$selectedAnnotation],
      });
    }
  }

  function selectAnnotationGroup(annotationGroup: AnnotationGroup<VideoAnnotationObject>, selectedFrame?: number) {
    setSelectedAnnotationGroup(annotationGroup);

    const firstAnnotation = annotationGroup.annotations[0];
    /**
     * Set mode to the annotation shape type when selecting an annotation
     */
    if (isNoteMode) {
      return;
    } else if (selectedFrame && firstAnnotation.shape.type && editable) {
      /**
       * If user select timeline row at specific frame (selectedFrame is exists)
       * and workflow step is in review or annotation
       */
      setCurrentModeTo(firstAnnotation.shape.type);
      selectClosestAnnotation(annotationGroup, selectedFrame);
      // Register selection-specific shortcuts for the current mode
      registerOnSelectBoxModeShortcuts(context, undefined, annotationGroup.groupId, () => $currentFrame);
    } else {
      selectAnnotation(undefined);
      setCurrentModeTo(DEFAULT_MODE);
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
      setCurrentModeTo(closestAnnotation.shape.type);
      selectAnnotation(closestAnnotation);
    }

    return closestAnnotation;
  }

  let annotations_promise: Promise<VideoAnnotationObject[]> = $derived.by(() => {
    $idbUpdatedAt; // eslint-disable-line @typescript-eslint/no-unused-expressions

    if (!annotationsIDB) return new Promise((_, ko) => ko("no database"));

    let p = annotationsIDB.getAllStore("annotations");

    p.then((updatedAnnotations) => {
      $boundingBoxes = updatedAnnotations;
    });

    return p;
  });

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

  // Helper function to normalize interpolated points to Point[]
  function normalizePoints(points: Point[] | InterpolatedVertex[] | undefined): Point[] | undefined {
    if (!points) return undefined;
    // Check if first element is InterpolatedVertex by checking if it has a 'point' property
    if (points.length > 0 && typeof points[0] === "object" && "point" in points[0]) {
      return (points as InterpolatedVertex[]).map((item) => item.point);
    }
    return points as Point[];
  }

  async function reSelectCategory(reselectedCategoryId: string) {
    if (!$selectedAnnotationGroup) return;

    /** Update annotation group category */
    context.commands.run("annotation.updateGroupCategory", {
      groupId: $selectedAnnotationGroup.groupId,
      categoryIdToBeUpdate: reselectedCategoryId,
    });
  }

  /** TIMELINE */
  let timelineHeight = $state<number>(0);

  function onTimelineResize(resizeValue: number) {
    timelineHeight = window.innerHeight * (resizeValue / 100);
  }
</script>

<div class="relative flex h-full w-full flex-col">
  {#key [ShortcutManager, ShortcutManager.currentMode, ShortcutManager.getCurrentMode(), $selectedAnnotation]}
    <CommandDialog bind:open={commandOpen} accesskey={ShortcutManager.getCurrentMode()}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading={`MODE: ${ShortcutManager.getCurrentMode()}`}>
          {#each Object.entries(ShortcutManager.getEffectiveKeyMap($currentMode) || {}) as [key, value] (key)}
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
            selectedCategory={annotationValue.category}
            {annotationValue}
            onSelectCategory={(selectedCategory) => {
              if (!selectedCategory) selectAnnotation();
              annotationValue = {
                ...annotationValue,
                category: selectedCategory,
              };
              onEditValue({ category: annotationValue.category }, $currentMode);
            }}
            onEditValue={(value) => value && onEditValue(value, $currentMode)}
            disabled={false}
          />
        {:else}
          <AnnotationSidebar
            view="popover"
            sidebarWidthRem={annotationSidebarWidthRem}
            class="rounded-t-lg"
            db={annotationsIDB}
            {annotationValue}
            {onEditValue}
            onSelectAnnotation={selectAnnotation}
            onSelectAnnotationGroup={() => {}}
            onDeleteAnnotation={deleteAnnotation}
            onEditability={setEditability}
            onVisibility={setVisibility}
            {context}
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
            switch ($currentMode) {
              case ENTRY_ROOT:
                onShapeSelection(ENTRY_ROOT, $currentFrame);
                break;
              default:
                if (shapeSelectionArgs) onShapeSelection(...shapeSelectionArgs);
            }
          }}
          disabled={shapeSelectionArgs == undefined && ENTRY_ROOT != $currentMode}>Confirm</Button
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
              {onEditValue}
              onSelectAnnotation={selectAnnotation}
              onSelectAnnotationGroup={selectAnnotationGroup}
              onDeleteAnnotation={deleteAnnotation}
              onEditability={setEditability}
              onVisibility={setVisibility}
              {context}
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
                frame={$currentFrame}
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
                    setCurrentFrame(current);
                    setTotalFrames(total);
                    isPlaying = playing;
                  }}
                  onVolumeChange={(level, muted) => (volume = { level, muted })}
                />
              </SvgOverlay>

              <PropertiesSidebar
                {annotationId}
                {annotationValue}
                {onEditValue}
                onReSelectCategory={reSelectCategory}
                {context}
              />
            </section>
          </ResizablePane>
        </ResizablePaneGroup>
      </ResizablePane>

      <ResizableHandle withHandle />

      <ResizablePane defaultSize={25} minSize={15}>
        <AnnotationFooter>
          <AnnotationFooterToolbar>
            <VideoController {isPlaying} {zoom} {volume} bind:video={player} />

            <TimelineController />
          </AnnotationFooterToolbar>

          {#await annotations_promise then annotations}
            <Timeline
              {annotations}
              {timelineHeight}
              onSeekFrame={seekToFrame}
              onToggleVisibility={() => {}}
              onToggleEditability={() => {}}
              onDeleteAnnotations={() => {}}
            />
          {/await}

          <!-- <TimelineTable
            bind:this={timelineTable}
            {annotations_promise}
            {scale}
            {zoom}
            {currentFrame}
            {totalFrames}
            {allHidden}
            {allLocked}
            {isPlaying}
            onSeekFrame={seekToFrame}
            onEditability={setEditability}
            onVisibility={setVisibility}
            onDeleteAnnotation={deleteAnnotation}
            onSelectAnnotation={selectAnnotation}
            onSelectGroupAtFrame={selectAnnotationGroup}
            onScaleChange={(s) => {
              scale = s;
            }}
            onZoomChange={(z) => {
              zoom = z;
            }}
          /> -->
        </AnnotationFooter>
      </ResizablePane>
    </ResizablePaneGroup>
  </div>
</div>
