<script lang="ts">
  import { onMount, setContext } from "svelte";

  import { Button } from "$lib/components/ui/Button";
  import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
  } from "$lib/components/ui/Command";
  import { getShortcuts } from "$lib/components/ui/Kbd/utils";
  import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/Popover";
  import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "$lib/components/ui/Resizable";

  import { ShortcutManager } from "$idah/shortcut/shortcut-manager.svelte";

  import {
    DEFAULT_MODE,
    EDITOR_MODE_TOOLS,
    ENTRY_ROOT,
    IDAH_NOTE,
    IDAH_VIDEO_BOUNDING_BOX,
    IDAH_VIDEO_POLYGON,
  } from "$lib/plugin/type";
  import { requiredFullfilled } from "$lib/components/App/PropertySelector";
  import { registerCommands } from "$lib/plugin/video-annotation-activity/commands.svelte";
  import {
    annotationsIndexedDB,
    type AnnotationBackend,
  } from "$lib/plugin/video-annotation-activity/data/annotation/annotaiton-backend.svelte";
  import {
    registerOnSelectShortcuts,
    registerShortcuts,
    registerShortcutsReference,
  } from "$lib/plugin/video-annotation-activity/shortcut";
  import { boundingBoxes, entryRoot } from "$lib/plugin/video-annotation-activity/store/idb-store.svelte";
  import {
    currentFrame,
    currentMode,
    deselectAnnotation,
    isVideoPlaying,
    selectedAnnotation,
    selectedAnnotationGroup,
    setCurrentFrame,
    setCurrentModeTo,
    setSelectedAnnotation,
    setSelectedAnnotationGroup,
    setTotalFrames,
    setVideoIsPlaying,
    totalFrames,
  } from "$lib/plugin/video-annotation-activity/store/store";
  import { uiStore } from "$lib/plugin/video-annotation-activity/store/ui-store.svelte";
  import DebugConsole from "$lib/plugin/video-annotation-activity/components/DebugConsole.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import {
    findClosestAnnotationInGroup,
    groupAnnotations,
    transformAnnotationsToTracks,
  } from "$lib/plugin/video-annotation-activity/utils/group-annotation.svelte";

  import AnnotationFooterToolbar from "$lib/components/Layout/Footer/AnnotationFooterToolbar.svelte";
  import AnnotationFooter from "$lib/components/Layout/Footer/AnnotationFooter.svelte";
  import AnnotationSidebar from "$lib/components/Layout/Sidebar/AnnotationSidebar.svelte";
  import PropertiesSidebar from "$lib/components/Layout/Sidebar/PropertiesSidebar.svelte";
  import PropertySelector from "$lib/components/App/PropertySelector/PropertySelector.svelte";
  import ContextMenu from "$lib/components/App/ContextMenu/ContextMenu.svelte";
  import SvgOverlay, { type OnAddNewNoteParams } from "$lib/components/App/Viewport/SvgOverlay.svelte";
  import AnnotationTrackInfo from "$lib/components/App/Timeline/annotations/_AnnotationTrackInfo.svelte";
  import TrackInfoHeader from "$lib/components/App/Timeline/annotations/_TrackInfoHeader.svelte";
  import Timeline from "$lib/components/App/Timeline/Timeline.svelte";
  import TimelineZoom from "$lib/components/App/Timeline/TimelineZoom.svelte";
  import VideoController from "$lib/components/App/Viewport/VideoController.svelte";
  import Video from "$lib/components/App/Viewport/Video.svelte";

  import {
    type Point,
    type VideoAnnotationObject,
    type VideoFrameSelection,
    type VideoShape,
  } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

  import type { IActivityContext, IMedia } from "$idah/context/activity-context";
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

  let entryId = $derived(context.id);
  let mediaUrl = $derived(context.mediaUrl);
  let workflowStep = $derived(context.workflowStep);
  let mediaInfo: IMedia | undefined = $state(undefined);
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
  let annotationFooterHeight: number = $state(0);
  let annotationFooterToolbarHeight: number = $state(0);
  let zoom = $state(85);

  let length = $state(0);

  // Variables::Timeline Container width for calculating dynamic ruler steps
  let viewportContainerWidth = $state<number>(1000); // default value until measured

  // Min zoom: show all frames → range = length → zoom = 1
  const zoomMin = 1;
  // Max zoom: 80px per frame → range = containerWidth / 80 → zoom = length * 80 / containerWidth
  const zoomMax = $derived(Math.max(zoomMin, (length * 80) / Math.max(1, viewportContainerWidth)));

  // Zoom level: ratio of total length over visible range
  const zoomLevel = $derived(length / (viewport.timeline.range.endRange - viewport.timeline.range.startRange));
  const displayZoomLevel = $derived(Math.max(zoomMin, Math.min(zoomMax, zoomLevel)));

  const TARGET_MAJOR_STEP_PX = 80; // pixels per major step
  const TARGET_MINOR_STEP_PX = 20; // pixels per minor step

  // Dynamic ruler step calculation: round to series 1, 2, 10, 20, 100, 200, 1000, 2000...
  // serie(x) => x.odd ? serie(x-1)*5 : serie(x-1) * 2, with serie(1) = 1
  function generateSeriesUpTo(target: number): number[] {
    const series: number[] = [1]; // serie(1) = 1
    let current = 1;
    let idx = 1;
    while (current < target) {
      idx++;
      current = series[idx - 2] * (idx % 2 === 0 ? 2 : 5);
      series.push(current);
    }
    return series;
  }

  function roundToSeries(target: number): number {
    if (target <= 1) return 1;
    const series = generateSeriesUpTo(target);
    // Check values around target to find closest
    let closest = series[0];
    for (const val of series) {
      if (val <= target) closest = val;
    }
    // Find the next value to check if it's closer
    const nextIdx = series.indexOf(closest) + 1;
    const nextVal = nextIdx < series.length ? series[nextIdx] : Infinity;
    return Math.abs(target - closest) <= Math.abs(target - nextVal) ? closest : nextVal;
  }

  const effectiveRulerMajorStep = $derived.by<number>(() => {
    if (viewportContainerWidth <= 0) return 50;
    const target = (TARGET_MAJOR_STEP_PX * (viewport.timeline.range.endRange - viewport.timeline.range.startRange)) / viewportContainerWidth;
    return Math.max(1, roundToSeries(Math.max(1, target)));
  });
  const effectiveRulerMinorStep = $derived.by<number>(() => {
    if (viewportContainerWidth <= 0) return 10;
    const target = (TARGET_MINOR_STEP_PX * (viewport.timeline.range.endRange - viewport.timeline.range.startRange)) / viewportContainerWidth;
    const rounded = roundToSeries(Math.max(1, target));
    return rounded === effectiveRulerMajorStep ? 0 : rounded;
  });

  let annotationsIDB: AnnotationBackend | undefined = $state();
  let volume = $state({ level: 0, muted: true });
  let tools: {
    name: string;
    label: string;
    type: string;
    iconName: string;
    disabled?: boolean;
    handleClick: () => void;
  }[] = $state([]);

  let overlay: SvgOverlay | undefined = $state();
  let showPopOver = $state(false);
  let videoResizedAt = $state(new Date());

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

      const matched_key = shortcut_keys.find((key) => keymap[key]);
      if (matched_key) {
        e.preventDefault();
        keymap[matched_key].action();
      }
    };

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  });

  $effect(() => {
    context.tools.setTool($currentMode);
  });

  onMount(async () => {
    mediaInfo = await context.mediaInfo();

    const totalFrames = Math.round((mediaInfo.meta.duration as number) * (mediaInfo.meta.fps as number));
    setTotalFrames(totalFrames);
    length = totalFrames;
    viewport.timeline.range.startRange = 0;
    viewport.timeline.range.endRange = totalFrames;
    // setAnnotationFrame(1);

    // Generate the full static reference list of shortcuts and register them to the shared context
    registerShortcutsReference(context);

    $boundingBoxes = [];

    try {
      annotationsIDB = await annotationsIndexedDB(["idah-video", "entry", entryId].join(":"));

      /** Register commands */
      registerCommands({
        context,
        getDb: () => annotationsIDB,
        updaters: {
          setAnnotationValue: (v) => {
            annotationValue = v;
          },
          selectAnnotation: (v) => {
            selectAnnotation(v);
          },
        },
      });

      fetchAnnotations(annotationsIDB).then(() => {
        if (!annotationsIDB) return;

        // quick fix if unsynced data, though we dont have way to send it anyway for now if so
        const entryRootAnnotation = annotationsIDB.annotations.find((a) => a.shape.type === ENTRY_ROOT);
        if (entryRootAnnotation) $entryRoot = entryRootAnnotation;
      });
    } catch (e) {
      console.error(e);
    }

    /** TOOLS CONFIGURATION */
    const toolListConfig = [
      {
        name: "tools.visual",
        label: "Visual",
        type: DEFAULT_MODE,
        iconName: "mouse-pointer-2",
        command: "tools.visual",
      },
      {
        name: "tools.bounding_box",
        label: "Bounding Box",
        type: IDAH_VIDEO_BOUNDING_BOX,
        iconName: "vector-square",
        disabled: !editable,
        command: "tools.bounding_box",
      },
      {
        name: "tools.polygon",
        label: "Polygon",
        type: IDAH_VIDEO_POLYGON,
        iconName: "polygon",
        disabled: !editable,
        command: "tools.polygon",
      },
      {
        name: "tools.note",
        label: "Add Note",
        type: IDAH_NOTE,
        iconName: "message-circle",
        disabled: !notable, // Note: Only allow to create note when workflow steps are "annotate" and "review"
        command: "tools.note",
      },
    ];

    const toolConfig = toolListConfig.filter((tool) => {
      if (EDITOR_MODE_TOOLS.includes(tool.type)) {
        return !!context.config[tool.type];
      }
      return true;
    });

    tools = toolConfig.map((tool) => {
      return {
        name: tool.name,
        label: tool.label,
        type: tool.type,
        iconName: tool.iconName,
        disabled: tool.disabled,
        handleClick: () => context.commands.run(tool.command),
      };
    });

    context.tools.setTools(tools);

    registerShortcuts({
      commands: context.commands,
      player: () => player,
      flush: () => context.annotations.flush(),
      switch_mode: (mode: string) => {
        const config = toolConfig.find((c) => c.type === mode) || toolListConfig[0];
        context.commands.run(config.command);
      },
      zoom: { in: () => overlay?.zoomIn?.(), out: () => overlay?.zoomOut?.() },
    });

    function fetchAnnotations(db: AnnotationBackend, page = 1, itemsPerPage = 100): Promise<void> {
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
              fetchAnnotations(db, page + 1).then(resolve, reject);
            });
          } else {
            resolve();
          }
        });
      });
    }
  });

  function seekToFrame(frame: number) {
    player?.seekToFrame(frame);
  }

  async function addAnnotation(shape: AnnotationShape, value: AnnotationValue = {}) {
    if (!editable) return;

    const { type, start, end, frames } = shape;
    const videoShape: VideoShape = { type, start, end, frames };

    context.commands.run("annotation.add", { shape: videoShape, value });

    const timelineScrollAreaEl = document.getElementById("timeline-scroll-area");

    if (timelineScrollAreaEl) {
      const scrollContainer = timelineScrollAreaEl.querySelector(`[data-slot="scroll-area-viewport"]`) as HTMLElement;

      setTimeout(() => {
        // scroll to bottom most
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: "instant",
        });
      }, 100);
    }
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
      registerOnSelectShortcuts(annotation.shape.type, {
        commands: context.commands,
        selectedId: annotation.metadata.id,
        selectedGroupId: annotation.metadata.metadata?.group_id || $selectedAnnotationGroup?.groupId,
        getCurrentFrame: () => $currentFrame,
      });
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
    } else if (firstAnnotation.shape.type && editable) {
      /**
       * If user select timeline row at specific frame (selectedFrame is exists)
       * and workflow step is in review or annotation
       */
      if (selectedFrame) {
        /** Set current mode and select closest annotation when selectedFrame is exitsts */
        setCurrentModeTo(firstAnnotation.shape.type);
        const closestAnnotation = selectClosestAnnotation(annotationGroup, selectedFrame);

        /** Register selection-specific shortcuts for the current mode with closest annotation id */
        registerOnSelectShortcuts(firstAnnotation.shape.type, {
          commands: context.commands,
          selectedId: closestAnnotation.metadata.id,
          selectedGroupId: annotationGroup.groupId,
          getCurrentFrame: () => $currentFrame,
        });
      } else {
        setCurrentModeTo(DEFAULT_MODE);
        deselectAnnotation();
        /** Register selection-specific shortcuts for the current mode with non selectedId */
        registerOnSelectShortcuts(firstAnnotation.shape.type, {
          commands: context.commands,
          selectedId: undefined,
          selectedGroupId: annotationGroup.groupId,
          getCurrentFrame: () => $currentFrame,
        });
      }
    } else {
      selectAnnotation(undefined);
      setCurrentModeTo(DEFAULT_MODE);
    }
  }

  function selectClosestAnnotation(annotationGroup: AnnotationGroup<VideoAnnotationObject>, frame: number) {
    const closestAnnotation = findClosestAnnotationInGroup({
      annotationGroup,
      frame,
    });
    setCurrentModeTo(closestAnnotation.shape.type);
    selectAnnotation(closestAnnotation);

    return closestAnnotation;
  }

  function setAnnotationFrame(frame: number) {
    if (!$selectedAnnotationGroup || !annotationsIDB) return;

    const annotationGroups = groupAnnotations(annotationsIDB.annotations);

    // Find the annotation group to get all annotations in the group
    const newSelectedAnnotationGroup = annotationGroups.find(
      (group) => group.groupId === $selectedAnnotationGroup?.groupId,
    );

    if (newSelectedAnnotationGroup) {
      const closestAnnotation = findClosestAnnotationInGroup({
        annotationGroup: newSelectedAnnotationGroup,
        frame: frame,
      });

      if (closestAnnotation.metadata.id === $selectedAnnotation?.metadata.id) {
        return;
      }

      setSelectedAnnotation(closestAnnotation);
      setSelectedAnnotationGroup({
        groupId: newSelectedAnnotationGroup.groupId,
        annotations: [closestAnnotation],
      });
    }
  }

  // Sync annotations to boundingBoxes whenever they change
  $effect(() => {
    if (annotationsIDB) {
      $boundingBoxes = annotationsIDB.annotations;
    }
  });

  let annotations_promise: Promise<VideoAnnotationObject[]> = $derived.by(() => {
    if (!annotationsIDB) return new Promise(() => {});

    // Return reactive annotations from the IndexedDB instance
    const annotations = annotationsIDB.annotations;
    return Promise.resolve(annotations);
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

  async function reSelectCategory(reselectedCategoryId: string) {
    if (!$selectedAnnotationGroup) return;

    /** Update annotation group category */
    context.commands.run("annotation.updateGroupCategory", {
      groupId: $selectedAnnotationGroup.groupId,
      categoryIdToBeUpdate: reselectedCategoryId,
    });

    // Update the currently selected annotation value to reflect the category change in the properties sidebar
    onEditValue({ category: reselectedCategoryId }, $currentMode);
  }

  function applyZoom(newZoom: number) {
    // Keep the current frame (caret/selection) fixed when zooming
    const frame = viewport.video.currentFrame.value;
    const newRange = length / newZoom;

    let newStart = frame - (frame - viewport.timeline.range.startRange) * (newRange / (viewport.timeline.range.endRange - viewport.timeline.range.startRange));
    let newEnd = newStart + newRange;

    // Clamp within [0, length]
    if (newStart < 0) {
      newStart = 0;
      newEnd = newRange;
    }

    if (newEnd > length) {
      newEnd = length;
      newStart = length - newRange;
    }

    viewport.timeline.range.startRange = newStart;
    viewport.timeline.range.endRange = newEnd;
  }
</script>

<div class="relative flex h-full w-full flex-col">
  {#key [ShortcutManager, ShortcutManager.currentMode, ShortcutManager.getCurrentMode(), $selectedAnnotation]}
    <!-- All available shortcuts list -->
    <CommandDialog bind:open={uiStore.isCommandDialogOpen} accesskey={ShortcutManager.getCurrentMode()}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="All Shortcuts">
          <!-- Get shortcuts from reference list -->
          {#each Object.entries(context.shortcutReferences || {}) as [name, value] (name)}
            <CommandItem>
              <span>{value.label} ({value.description})</span>
              <CommandShortcut>
                <!-- Get humanized key combinations, with symbols, join if multiple is available for an action  -->
                {getShortcuts(value.keyCombinations)?.join(" or ")}
              </CommandShortcut>
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
          <PropertySelector
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
          disabled={shapeSelectionArgs == undefined && ENTRY_ROOT != $currentMode}
        >
          Confirm
        </Button>
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
              onSelectAnnotationGroup={(annotationGroup) => selectClosestAnnotation(annotationGroup, $currentFrame)}
              onDeleteAnnotation={deleteAnnotation}
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
              {#if mediaInfo}
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
                  isPlaying={$isVideoPlaying}
                >
                  <!-- container context ?-->
                  <Video
                    bind:this={player}
                    bind:element={player_container}
                    src={mediaUrl}
                    fps={mediaInfo.meta.fps as number}
                    onTogglePlay={(isPlaying: boolean) => setVideoIsPlaying(isPlaying)}
                    onResize={() => {
                      videoResizedAt = new Date();
                    }}
                    onFrameUpdate={(currentFrame: number) => {
                      setCurrentFrame(currentFrame);
                      setAnnotationFrame(currentFrame);
                    }}
                    onVolumeChange={(level: number, muted: boolean) => {
                      volume = { level, muted };
                    }}
                  />
                </SvgOverlay>
              {/if}

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

      <ResizablePane defaultSize={25} minSize={20} maxSize={60}>
        <AnnotationFooter bind:annotationFooterHeight>
          <AnnotationFooterToolbar bind:annotationFooterToolbarHeight>
            <VideoController {zoom} {volume} bind:video={player} />

            <!-- <TimelineControllerLegacy /> -->
            <TimelineZoom {displayZoomLevel} {applyZoom} zoomMin={zoomMin} zoomMax={zoomMax} />
          </AnnotationFooterToolbar>

          {#if annotationsIDB}
            <Timeline
              bind:viewport={viewport.timeline.range}
              items={transformAnnotationsToTracks({
                annotations: annotationsIDB.annotations,
                labelConfig: context.config,
              })}
              {length}
              remainingHeight={annotationFooterHeight - annotationFooterToolbarHeight}
              rulerSmallStep={effectiveRulerMinorStep}
              rulerBigStep={effectiveRulerMajorStep}
              bind:currentFrame={viewport.video.currentFrame.value}
              oncontainerWidthChange={(newWidth) => (viewportContainerWidth = newWidth)}
              onDimensionsChange={(w, h) => {
                viewport.timeline.dimensions = [w, h];
              }}
            >
              {#snippet TrackInfoHeaderSlot()}
                <TrackInfoHeader annotations={annotationsIDB?.annotations ?? []} />
              {/snippet}

              {#snippet TrackInfoSlot({ track })}
                <AnnotationTrackInfo {track} onClick={selectAnnotation} />
              {/snippet}
            </Timeline>

            <!-- TODO: Will be remove after finish on new timeline -->
            <!-- <TimelineLegacy
              annotations={annotationsIDB.annotations}
              {annotationFooterHeight}
              onSeekFrame={seekToFrame}
              onSelectAnnotationGroup={selectAnnotationGroup}
            /> -->
          {/if}
        </AnnotationFooter>
      </ResizablePane>
    </ResizablePaneGroup>
  </div>
</div>

<DebugConsole />
<ContextMenu />
