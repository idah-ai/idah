<script lang="ts">
  import { onMount } from "svelte";

  import { Button } from "$lib/components/ui/Button";
  import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/Popover";
  import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "$lib/components/ui/Resizable";

  import { requiredFullfilled } from "$lib/components/App/SelectionPanel";
  import { resolveFrame, resolveEntryRoot } from "$lib/utils/tagging-annotations";
  import {
    findClosestAnnotationInGroup,
    groupAnnotations,
  } from "$lib/components/App/VideoAnnotationWorkspace/utils/group-annotation.svelte";
  import { data } from "$lib/state/data.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { syncStatus } from "$lib/state/driver.svelte";
  import { entryRoot } from "$lib/state/entry-root.svelte";
  import { media } from "$lib/state/media.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { BOUNDING_BOX_MODE, POLYGON_MODE, viewport } from "$lib/state/viewport.svelte";
  import { annotation } from "$lib/state/annotation.svelte";
  import {
    VIDEO_BOUNDING_BOX as IDAH_VIDEO_BOUNDING_BOX,
    VIDEO_POLYGON as IDAH_VIDEO_POLYGON,
    ENTRY_ROOT,
    VIDEO_FRAME,
    NON_DRAWABLE_SHAPE_TYPES,
  } from "$lib/types";

  import BottomPanel from "$lib/components/App/BottomPanel/BottomPanel.svelte";
  import AnnotationSidebar from "$lib/components/App/CategorySelector/AnnotationCategorySelector.svelte";
  import PropertiesSidebar from "$lib/components/App/CategorySelector/PropertiesCategorySelector.svelte";
  import ContextMenu from "$lib/components/App/ContextMenu/ContextMenu.svelte";
  import DebugConsole from "$lib/components/App/DebugConsole.svelte";
  import SelectionPanel from "$lib/components/App/SelectionPanel/SelectionPanel.svelte";
  import ShapesContainer, { type OnAddNewNoteParams } from "$lib/components/App/Viewport/Shapes/ShapesContainer.svelte";
  import Video from "$lib/components/App/Viewport/Video.svelte";
  import VideoCanvas from "$lib/components/App/Viewport/VideoCanvas.svelte";
  import ConfirmDialog from "$lib/components/App/ConfirmDialog/ConfirmDialog.svelte";
  import { draft as polygonDraft } from "$lib/commands/annotation/polygon.add_point.svelte";

  import type { IVideoAnnotationRecord, IVideoAnnotationShape, IVideoFrameSelection, IVideoAnnotationValue } from "$lib/types";
  import type { Point } from "$lib/utils/math/point";

  // Local type aliases for V1-compatible annotation shapes/values
  type AnnotationShape = Record<string, unknown> & { type: string; start?: number; end?: number; frames?: IVideoFrameSelection[] };
  type AnnotationValue = Record<string, unknown> & { category?: string; attributes?: Record<string, unknown> };
  interface AnnotationGroup<T> {
    groupId: string;
    annotations: T[];
  }

  // Local derived aliases for V2 state
  let mode = $derived(viewport.mode);
  let selAnnotation = $derived(
    selection.value?.type === "annotation" ? (selection.value as any).annotation : undefined,
  );
  let selGroup = $derived(selection.value?.type === "group" ? selection.value : undefined);

  // Variables
  const editableWorkflowSteps = ["annotate", "review"];
  const notableWorkflowSteps = ["annotate", "review", "done"];

  let entryId = $derived(getDriver().id);
  let mediaUrl = $derived(media.url);
  let workflowStep = $derived(getDriver().workflowStep);
  let mediaInfo: { meta: Record<string, unknown> } | undefined = $state(undefined);
  let editable = $derived<boolean>(editableWorkflowSteps.includes(workflowStep) && !viewport.isReviewWorkspace);
  let notable = $derived<boolean>(notableWorkflowSteps.includes(workflowStep));
  let isNoteMode = $derived(mode === "note");

  let player: Video | undefined = $state();
  let player_container: HTMLDivElement | undefined = $state();
  let canvasElement: HTMLCanvasElement | undefined = $state();

  let annotationSidebarResizablePercentage = $state<number>(16);
  let annotationSidebarWidthRem = $derived<number>(annotationSidebarResizablePercentage + 3);

  let annotationId = $derived<string | undefined>(selAnnotation?.id);

  /** Mutable value used during annotation creation (popover category/property selection).
   *  Once confirmed, this is merged into the final annotation. */
  let pendingValue: AnnotationValue = $state({});
  let annotationValue: AnnotationValue = $derived.by(() => selAnnotation?.value || pendingValue || {});

  /** Whether the user can confirm the current annotation creation (has category + all required properties filled). */
  let canConfirm = $derived.by(() => {
    if (!editable || isNoteMode) return false;

    if (mode === ENTRY_ROOT) {
      if (!pendingValue.category || pendingValue.category === "") return false;

      const properties =
        getDriver().getFilteredConfig(mode, pendingValue as unknown as Record<string, unknown>)?.properties ?? [];

      return requiredFullfilled(pendingValue, properties);
    }

    if (!shapeSelectionArgs) return false;
    if (!pendingValue.category || pendingValue.category === "") return false;
    const properties =
      getDriver().getFilteredConfig(shapeSelectionArgs[0], pendingValue as unknown as Record<string, unknown>)
        ?.properties ?? [];

    return requiredFullfilled(pendingValue, properties);
  });

  let length = $state(0);
  let tools: {
    name: string;
    label: string;
    type: string;
    iconName: string;
    disabled?: boolean;
    handleClick: () => void;
  }[] = $state([]);

  let overlay: ShapesContainer | undefined = $state();
  let showPopOver = $state(false);

  /** Pending annotation (shape + value) waiting for category confirmation. */
  let pendingAnnotation = $derived.by<IVideoAnnotationRecord | undefined>(() => {
    if (!shapeSelectionArgs) return undefined;
    const [type, frame, points, angle, selectedId] = shapeSelectionArgs;
    let shape: AnnotationShape = { type };
    switch (type) {
      case IDAH_VIDEO_BOUNDING_BOX:
        shape = { ...shape, start: frame, end: frame, frames: [{ frame, angle, points }] };
        break;
      case IDAH_VIDEO_POLYGON:
        shape = { ...shape, start: frame, end: frame, frames: [{ frame, points }] };
        break;
      default:
        return undefined;
    }
    return {
      id: "pending",
      shape: shape as IVideoAnnotationShape,
      value: { ...pendingValue },
      metadata: {},
      synced: true,
    } as unknown as IVideoAnnotationRecord;
  });

  /** Category color for the create-shape previews. */
  let categoryColor = $derived.by<string | undefined>(() => {
    if (!pendingValue.category) return undefined;
    const shapeType = shapeSelectionArgs?.[0] ?? viewport.mode;
    const config = getDriver().config[shapeType];
    const cat = config?.values?.find((v) => v.id === pendingValue.category);
    return cat?.color ?? undefined;
  });
  $effect(() => {
    if (typeof window === "undefined") return;

    const handleKeydown = (e: KeyboardEvent) => {
      // Block all keyboard shortcuts while sync error is active.
      if (syncStatus.error !== null) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      const isTyping =
        activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA" || activeElement?.isContentEditable;

      if (isTyping) return;

      // Delegate to the V2 driver's keyboard resolution
      const consumed = getDriver().handleKeydown(e);
      if (consumed) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  });

  $effect(() => {
    const viewportMode = viewport.mode;

    getDriver().setMode(viewportMode);

    // Reset pendingValue when getting out of drawing modes,
    // to avoid stale pendingValue when user switches back to drawing mode later
    if (viewportMode !== BOUNDING_BOX_MODE && viewportMode !== POLYGON_MODE) {
      pendingValue = {};
    }

    // Deselect group or annotation when switching to drawing modes
    if (viewport.isCreationMode) selection.deselect();
  });

  onMount(async () => {
    const driver = getDriver();
    const meta = driver.media.meta;
    mediaInfo = { meta };

    const totalFrames = Math.floor((meta.duration as number) * (meta.fps as number));
    length = totalFrames;
    viewport.timeline.range.startRange = 0;
    viewport.timeline.range.endRange = totalFrames;
    viewport.video.goToFrame(0);

    // annotations are now derived from the global data store
    // The store is already preloaded in initDataStores()

    // Find entry-root annotation from the global store
    const entryRootAnnotation = (data.annotations?.items ?? []).find((ann) => (ann.shape as any).type === ENTRY_ROOT);
    if (entryRootAnnotation) entryRoot.value = entryRootAnnotation;

    /** TOOLS CONFIGURATION */
    const toolListConfig = [
      {
        name: "tools.visual",
        label: "Visual",
        type: "default",
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
        type: "note",
        iconName: "message-circle",
        disabled: !notable, // Note: Only allow to create note when workflow steps are "annotate" and "review"
        command: "tools.note",
      },
    ];

    const toolConfig = toolListConfig.filter((tool) => {
      if (["idah-video:bounding-box", "idah-video:polygon"].includes(tool.type)) {
        const cfg = getDriver().config[tool.type];
        return cfg && cfg.values && cfg.values.length > 0;
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
        handleClick: () => getDriver().command.call(tool.command),
      };
    });

    // Set toolbar tools on the driver — the mock page's toolbar manager reads them
    // (Note: tools state is used by the Svelte component for inline tool tracking)
  });

  function seekToFrame(frame: number) {
    player?.seekToFrame(frame);
  }

  async function addAnnotation(shape: AnnotationShape, value: AnnotationValue = {}) {
    if (!editable) return;

    const { type, start, end, frames } = shape;
    const videoShape: IVideoAnnotationShape = {
      type,
      start: start!,
      end: end!,
      frames: frames as IVideoFrameSelection[],
    };

    getDriver().command.call("idah-video:annotation.add", { shape: videoShape, value });

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
    getDriver().command.call("idah-video:annotation.delete", { annotationId });
  }

  async function addSelection(id: string, selection: IVideoFrameSelection) {
    if (!editable) return;

    getDriver().command.call("idah-video:annotation.keyframe.add", { annotationId: id, selection });
  }

  async function deleteSelection(annotationId: string, frame: number) {
    if (!editable) return;

    getDriver().command.call("idah-video:annotation.keyframe.delete", { annotationId, frame });
  }

  function deleteAnnotation(annotation: IVideoAnnotationRecord, frame?: number) {
    if (!editable) return;

    if (frame != undefined) {
      deleteSelection(annotation.metadata!.id as string, frame);
    } else {
      removeAnnotation(annotation.metadata!.id as string);
    }
  }

  let shapeSelectionArgs:
    | [type: string, frame: number, _points: Point[], angle: number, selectedId?: string]
    | undefined = $state();

  function onEditValue(value: AnnotationValue, valueMode: string) {
    if (!editable) return;

    let requirementFullfilled = requiredFullfilled(
      value,
      getDriver().getFilteredConfig(valueMode, value as unknown as Record<string, unknown>)?.properties,
    );

    if (valueMode == ENTRY_ROOT && !selAnnotation && entryRoot.value?.metadata?.id)
      selection.selectAnnotation(entryRoot.value as any);

    // wait for confirmation
    if (showPopOver) {
      // During creation (no selected annotation), store the value in pendingValue so
      // the SelectionPanel can display it and the Confirm button can read it.
      if (!selAnnotation) {
        pendingValue = value;
      } else {
        selection.selectAnnotation({ ...selAnnotation, value: annotationValue } as any);
      }
      return;
    }

    if (valueMode == ENTRY_ROOT && !selAnnotation) {
      if (value.category && value.category != "" && requirementFullfilled)
        addAnnotation(entryRootFullRangeShape(), $state.snapshot(value));
    } else if (selAnnotation) {
      selection.selectAnnotation({ ...selAnnotation, value: annotationValue } as any);
      if (requirementFullfilled) updateAnnotationValue($state.snapshot(selAnnotation), $state.snapshot(value));
    } else if (selGroup) {
      // Update category for all annotations in the group
      getDriver().command.call("idah-video:annotation.update-group-category", {
        groupId: selGroup.groupId,
        categoryIdToBeUpdate: value.category,
      });
    } else if (valueMode !== ENTRY_ROOT) {
      // Sidebar category click: store category and enter drawing mode
      pendingValue = value;
      viewport.mode = valueMode;
    } else if (shapeSelectionArgs && requirementFullfilled) {
      showPopOver = false;
      onShapeSelection(...shapeSelectionArgs);
    }
  }

  /** Called by the Confirm button / Enter key in the popover.
   *  Creates the annotation with the value the user picked (category + any properties). */
  function confirmCreateAnnotation(
    type: string,
    frame: number,
    _points: Point[] = [],
    angle: number = 0,
    _selectedId?: string,
  ) {
    if (!editable || isNoteMode) return;

    let points = $state.snapshot(_points) as Point[];
    let value = $state.snapshot(pendingValue) as AnnotationValue;

    let shape: AnnotationShape = { type };
    shape = {
      ...shape,
      start: frame,
      end: frame,
      frames: [{ frame, angle, points }] as IVideoFrameSelection[],
    };

    shapeSelectionArgs = undefined;
    pendingValue = {};
    addAnnotation(shape, value);
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
      let annotation_value_from = $state.snapshot(pendingValue) as AnnotationValue;

      // todo proper validation
      let shape: AnnotationShape = { type };
      switch (type) {
        case "default":
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
        getDriver().config[type]?.values.some((v) => v.id == annotation_value_from.category) &&
        requiredFullfilled(
          annotation_value_from,
          getDriver().getFilteredConfig(type, annotation_value_from as unknown as Record<string, unknown>)?.properties,
        )
      ) {
        shapeSelectionArgs = undefined;
        pendingValue = {};
        addAnnotation(shape, annotation_value_from);
      } else {
        shapeSelectionArgs = [type, frame, _points, angle, selectedId];
        // Keep pendingValue so the popover shows the selected category
        showPopOver = true;
      }
    } else {
      addSelection(selectedId, { frame, angle, points });
    }
  }

  function updateAnnotationValue(ann: IVideoAnnotationRecord, value: AnnotationValue) {
    if (!editable) return;
    if (ann && annotation.isLocked(ann)) return;

    getDriver().command.call("idah-video:annotation.update", { annotation: ann, value });
  }

  /** Full-length frame range for the entry:root annotation so it survives the
   *  store's windowed range-fetch (shape.start <= rangeEnd && shape.end >= rangeStart)
   *  regardless of which window is loaded. Without it, an entry:root record with
   *  undefined start/end would be dropped outside certain windows. */
  function entryRootFullRangeShape(): AnnotationShape {
    return { type: ENTRY_ROOT, start: 0, end: Math.max(length - 1, 0), frames: [] };
  }

  // The entry:root annotation for this entry, derived reactively from the live
  // store (never a stale singleton) so the Tagging tab always reflects reality.
  let entryRootAnnotation = $derived<IVideoAnnotationRecord | undefined>(
    data.annotations?.items.find((a) => (a.shape as any).type === ENTRY_ROOT) as IVideoAnnotationRecord | undefined,
  );

  // The idah-video:frame annotation for the CURRENT frame, derived reactively
  // so it tracks the user scrubbing the timeline with no manual sync code needed.
  let frameAnnotation = $derived.by<IVideoAnnotationRecord | undefined>(() => {
    if (!data.annotations) return undefined;
    const frame = viewport.video.currentFrame.value;
    return (data.annotations.items as unknown as IVideoAnnotationRecord[]).find(
      (a) => (a.shape as any).type === VIDEO_FRAME && a.shape.start === frame && a.shape.end === frame,
    );
  });

  // All idah-video:frame annotations for this entry, unfiltered by workspace
  // mode (frame tagging is an annotate-time feature, not review-only). Feeds the
  // pinned Tagging row in the Timeline.
  let frameAnnotations = $derived.by<IVideoAnnotationRecord[]>(() => {
    if (!data.annotations) return [];
    return (data.annotations.items as unknown as IVideoAnnotationRecord[])
      .filter((a) => (a.shape as any).type === VIDEO_FRAME)
      .sort((a, b) => a.shape.start - b.shape.start);
  });

  /** Set the whole entry tagging (entry:root. Uniqueness is enforced client-side:
   *  at most one entry:root annotation may exist per entry — creating a second
   *  one updates the existing record instead of duplicating. */
  function onEntryRootChange(value: AnnotationValue) {
    if (!editable) return;
    const items = (data.annotations?.items ?? []) as unknown as IVideoAnnotationRecord[];
    const resolution = resolveEntryRoot(items, value as IVideoAnnotationValue);
    if (resolution.action === "update") {
      updateAnnotationValue(resolution.existing, value);
    } else if (resolution.action === "create") {
      addAnnotation(entryRootFullRangeShape(), value);
    }
  }

  /** Set the current frame tagging (idah-video:frame. Uniqueness is enforced client-side
   *  per frame value: at most one idah-video:frame annotation may exist for a
   *  given frame — creating a second one for the same frame updates the existing
   *  record instead of duplicating. */
  function onFrameChange(value: AnnotationValue) {
    if (!editable) return;
    const frame = viewport.video.currentFrame.value;
    const items = (data.annotations?.items ?? []) as unknown as IVideoAnnotationRecord[];
    const resolution = resolveFrame(items, frame, value as IVideoAnnotationValue);
    if (resolution.action === "update") {
      updateAnnotationValue(resolution.existing, value);
    } else if (resolution.action === "create") {
      addAnnotation(
        { type: VIDEO_FRAME, start: frame, end: frame, frames: [{ frame, angle: 0, points: [] }] },
        value,
      );
    }
  }

  /** Delete the entry:root annotation for this entry. */
  function onDeleteEntryRoot() {
    if (!editable) return;
    const existing = entryRootAnnotation;
    if (existing) {
      getDriver().command.call("idah-video:annotation.delete", { annotationId: existing.id });
    }
  }

  /** Delete the idah-video:frame annotation for the current frame. */
  function onDeleteFrame() {
    if (!editable) return;
    const existing = frameAnnotation;
    if (existing) {
      getDriver().command.call("idah-video:annotation.delete", { annotationId: existing.id });
    }
  }

  function selectAnnotation(annotation?: IVideoAnnotationRecord) {
    if (annotation) {
      selection.selectAnnotation(annotation as any);
    } else {
      selection.deselect();
    }
  }

  function selectClosestAnnotation(annotationGroup: AnnotationGroup<IVideoAnnotationRecord>, frame: number) {
    const closestAnnotation = findClosestAnnotationInGroup({
      annotationGroup,
      frame,
    });
    selectAnnotation(closestAnnotation);

    return closestAnnotation;
  }

  function setAnnotationFrame(frame: number) {
    if (!selGroup) return;

    const annotationGroups = groupAnnotations(viewportAnnotations);

    // Find the annotation group to get all annotations in the group
    const newSelectedAnnotationGroup = annotationGroups.find((group) => group.groupId === selGroup?.groupId);

    if (newSelectedAnnotationGroup) {
      const closestAnnotation = findClosestAnnotationInGroup({
        annotationGroup: newSelectedAnnotationGroup,
        frame: frame,
      });

      if (closestAnnotation.metadata!.id === selAnnotation?.metadata?.id) {
        return;
      }

      selection.selectAnnotation(closestAnnotation as any);
      selection.selectGroup(newSelectedAnnotationGroup.groupId);
    }
  }

  // Derive viewport annotations from the global store. Non-drawable records
  // (entry:root / idah-video:frame) are excluded so they never render on canvas,
  // appear in the annotation sidebar, or reach the per-shape timeline tracks.
  let viewportAnnotations = $derived.by<IVideoAnnotationRecord[]>(() => {
    const raw = (data.annotations?.items ?? []).filter(
      (ann) => !NON_DRAWABLE_SHAPE_TYPES.has((ann.shape as any)?.type),
    );
    return raw.map((ann) => ({
      id: ann.id,
      shape: ann.shape as IVideoAnnotationShape,
      value: {
        category: ann.value?.category || "null",
        attributes: ann.value?.attributes ?? {},
      },
      metadata: ann.metadata ?? {},
      synced: ann.synced ?? true,
    })) as IVideoAnnotationRecord[];
  });

  let annotations_promise: Promise<IVideoAnnotationRecord[]> = $derived.by(() => {
    if (!data.annotations) return new Promise(() => {});
    return Promise.resolve(viewportAnnotations);
  });

  function showNewNotePopup(params: {
    anchorType: "entry" | "annotation";
    position?: Record<string, unknown>;
    annotationId?: string | null;
    screenX?: number;
    screenY?: number;
  }) {
    const { anchorType, position, annotationId, screenX, screenY } = params;
    const driver = getDriver();
    driver.notes.requestCreateNote({
      anchor_type: anchorType,
      annotation_id: annotationId ?? null,
      position,
    });
    // Report the screen position so the core overlay opens at the click point.
    driver.notes.reportNotePosition({ noteId: null, x: screenX, y: screenY });
  }

  async function reSelectCategory(reselectedCategoryId: string) {
    // onEditValue handles the update for both selAnnotation and selGroup cases
    onEditValue({ category: reselectedCategoryId }, mode);
  }
</script>

<div class="relative flex h-full w-full flex-col">
  <Popover
    open={showPopOver}
    onOpenChange={(open: boolean) => {
      if (!open && showPopOver) {
        // Popover closed via Escape/click-outside — restore drawing state
        annotationValue = {};
        pendingValue = {};
        const args = shapeSelectionArgs;
        shapeSelectionArgs = undefined;
        if (args) {
          const [type, frame, points, angle] = args;
          if (type === IDAH_VIDEO_POLYGON) {
            polygonDraft.points = points;
            viewport.mode = POLYGON_MODE;
          }
        }
        selectAnnotation();
      }
      showPopOver = open;
    }}
  >
    <PopoverTrigger></PopoverTrigger>

    <PopoverContent
      class="min-w-80 p-0"
      onkeydown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (!canConfirm) return;
          showPopOver = false;
          if (mode === "entry:root") {
            onShapeSelection("entry:root", viewport.video.currentFrame.value);
          } else if (shapeSelectionArgs) {
            confirmCreateAnnotation(...shapeSelectionArgs);
          }
        }
      }}
    >
      <div class="h-auto max-h-86 overflow-y-auto p-2">
        {#if pendingValue.category}
          <SelectionPanel
            selectedCategory={pendingValue.category}
            annotationValue={pendingValue}
            onSelectCategory={(selectedCategory) => {
              if (!selectedCategory) selectAnnotation();
              pendingValue = {
                ...pendingValue,
                category: selectedCategory,
              };
              onEditValue({ category: pendingValue.category }, mode);
            }}
            onEditValue={(value) => value && onEditValue(value, mode)}
            disabled={false}
          />
        {:else}
          <AnnotationSidebar
            view="popover"
            sidebarWidthRem={annotationSidebarWidthRem}
            class="rounded-t-lg"
            db={data.annotations}
            items={viewportAnnotations}
            {annotationValue}
            {onEditValue}
            onSelectAnnotation={selectAnnotation}
            onSelectAnnotationGroup={() => {}}
            onDeleteAnnotation={deleteAnnotation}
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
            pendingValue = {};
            const args = shapeSelectionArgs;
            shapeSelectionArgs = undefined;
            if (args) {
              const [type, frame, points, angle] = args;
              if (type === IDAH_VIDEO_POLYGON) {
                polygonDraft.points = points;
                viewport.mode = POLYGON_MODE;
              }
            }
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
                onShapeSelection(ENTRY_ROOT, viewport.video.currentFrame.value);
                break;
              default:
                if (shapeSelectionArgs && pendingValue.category) confirmCreateAnnotation(...shapeSelectionArgs);
            }
          }}
          disabled={!canConfirm}
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
              db={data.annotations}
              items={viewportAnnotations}
              {annotationValue}
              {onEditValue}
              onSelectAnnotation={selectAnnotation}
              onSelectAnnotationGroup={(annotationGroup) =>
                selectClosestAnnotation(annotationGroup, viewport.video.currentFrame.value)}
              onDeleteAnnotation={deleteAnnotation}
            />
          </ResizablePane>

          <!--
            NOTE: Can not resize annotation sidebar,
            as it will affect the note overlay and svg overlay
            <ResizableHandle withHandle />
          -->

          <ResizablePane defaultSize={75}>
            <section id="video-section" class="relative flex h-full w-full flex-1">
              {#if mediaInfo}
                <!-- Hidden decode source outside the zoom transform; frames land on VideoCanvas below. -->
                <Video
                  bind:this={player}
                  canvas={canvasElement}
                  src={mediaUrl}
                  fps={mediaInfo.meta.fps as number}
                  onTogglePlay={(_isPlaying: boolean) => {}}
                  onResize={() => {
                    // video resized
                  }}
                  onFrameUpdate={(currentFrame: number) => {
                    setAnnotationFrame(currentFrame);
                  }}
                  onVolumeChange={(level: number, muted: boolean) => {
                    viewport.video.sound = { level: level, muted };
                  }}
                />

                <ShapesContainer
                  bind:this={overlay}
                  {annotations_promise}
                  frame={viewport.video.currentFrame.value}
                  {pendingAnnotation}
                  {categoryColor}
                  onSelectAnnotation={selectAnnotation}
                  onSelection={onShapeSelection}
                  onAddNewNote={showNewNotePopup}
                  onChangeFrame={seekToFrame}
                  isPlaying={viewport.video.status === "play"}
                >
                  <VideoCanvas bind:canvas={canvasElement} bind:element={player_container} />
                </ShapesContainer>
              {/if}

              <PropertiesSidebar
                {annotationId}
                {annotationValue}
                {onEditValue}
                onReSelectCategory={reSelectCategory}
                {entryRootAnnotation}
                {frameAnnotation}
                currentFrame={viewport.video.currentFrame.value}
                onEntryRootChange={onEntryRootChange}
                onFrameChange={onFrameChange}
                onDeleteEntryRoot={onDeleteEntryRoot}
                onDeleteFrame={onDeleteFrame}
              />
            </section>
          </ResizablePane>
        </ResizablePaneGroup>
      </ResizablePane>

      <ResizableHandle withHandle />

      <ResizablePane defaultSize={25} minSize={20} maxSize={60}>
        <BottomPanel {viewportAnnotations} {length} bind:player volume={viewport.video.sound} {frameAnnotations} {entryRootAnnotation} />
      </ResizablePane>
    </ResizablePaneGroup>
  </div>
</div>

<DebugConsole />
<ContextMenu />
<ConfirmDialog />
