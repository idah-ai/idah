<script lang="ts">
  import { onMount } from "svelte";

  import { Button } from "$lib/components/ui/Button";
  import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/Popover";
  import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "$lib/components/ui/Resizable";

  import { requiredFullfilled } from "$lib/components/App/SelectionPanel";
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
  import { VIDEO_BOUNDING_BOX as IDAH_VIDEO_BOUNDING_BOX, VIDEO_POLYGON as IDAH_VIDEO_POLYGON } from "$lib/types";

  import BottomPanel from "$lib/components/App/BottomPanel/BottomPanel.svelte";
  import AnnotationSidebar from "$lib/components/App/CategorySelector/AnnotationCategorySelector.svelte";
  import PropertiesSidebar from "$lib/components/App/CategorySelector/PropertiesCategorySelector.svelte";
  import ContextMenu from "$lib/components/App/ContextMenu/ContextMenu.svelte";
  import DebugConsole from "$lib/components/App/DebugConsole.svelte";
  import SelectionPanel from "$lib/components/App/SelectionPanel/SelectionPanel.svelte";
  import ShapesContainer, { type OnAddNewNoteParams } from "$lib/components/App/Viewport/Shapes/ShapesContainer.svelte";
  import Video from "$lib/components/App/Viewport/Video.svelte";
  import ConfirmDialog from "$lib/components/App/ConfirmDialog/ConfirmDialog.svelte";
  import { draft as polygonDraft } from "$lib/commands/annotation/polygon.add_point.svelte";

  import type { IVideoAnnotationRecord, IVideoAnnotationShape, IVideoFrameSelection } from "$lib/types";
  import type { Point } from "$lib/utils/math/point";

  // Local type aliases for V1-compatible annotation shapes/values
  type AnnotationShape = Record<string, unknown> & { type: string; start?: number; end?: number };
  type AnnotationAttributes = Record<string, unknown>;
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

  let annotationSidebarResizablePercentage = $state<number>(16);
  let annotationSidebarWidthRem = $derived<number>(annotationSidebarResizablePercentage + 3);

  let annotationId = $derived<string | undefined>(selAnnotation?.id);

  /** Mutable category used during annotation creation/edit (popover category selection). */
  let pendingCategory: string | undefined = $state(undefined);
  /** Mutable open-ended properties used during annotation creation/edit. */
  let pendingValue: AnnotationAttributes = $state({}); // this IS attributes now, nothing else

  let annotationValue = $derived.by(() => ({
    category: selAnnotation?.category ?? pendingCategory,
    properties: selAnnotation?.properties ?? pendingValue ?? {},
  }));

  function resetPending() {
    pendingCategory = undefined;
    pendingValue = {};
  }

  /** Whether the user can confirm the current annotation creation (has category + all required properties filled). */
  let canConfirm = $derived.by(() => {
    if (!editable || isNoteMode) return false;

    if (mode === "entry:root") {
      if (!pendingCategory || pendingCategory === "") return false;

      const properties =
        getDriver().getFilteredConfig(mode, { category: pendingCategory, properties: pendingValue })?.properties ?? [];

      return requiredFullfilled(pendingValue, properties);
    }

    if (!shapeSelectionArgs) return false;
    if (!pendingCategory || pendingCategory === "") return false;
    const properties =
      getDriver().getFilteredConfig(shapeSelectionArgs[0], { category: pendingCategory, properties: pendingValue })
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
    const { type: _t, ...shapeArgs } = shape;
    return {
      id: "pending",
      shape_type: type,
      shape_args: shapeArgs as IVideoAnnotationShape,
      category: pendingCategory,
      properties: { ...pendingValue },
      metadata: {},
      synced: true,
    } as unknown as IVideoAnnotationRecord;
  });

  /** Category color for the create-shape previews. */
  let categoryColor = $derived.by<string | undefined>(() => {
    if (!pendingCategory) return undefined;
    const shapeType = shapeSelectionArgs?.[0] ?? viewport.mode;
    const config = getDriver().config[shapeType];
    const cat = config?.values?.find((v) => v.id === pendingCategory);
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
      resetPending();
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
    const entryRootAnnotation = (data.annotations?.items ?? []).find((ann) => ann.shape_type === "entry:root");
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

  async function addAnnotation(shape: AnnotationShape, category?: string, properties: AnnotationAttributes = {}) {
    if (!editable) return;

    const { type, start, end, frames } = shape;
    const videoShape: IVideoAnnotationShape = {
      start: start!,
      end: end!,
      frames: frames as IVideoFrameSelection[],
    };

    getDriver().command.call("annotation.add", { shape: videoShape, shape_type: type, category, properties });

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
    getDriver().command.call("annotation.delete", { annotationId });
  }

  async function addSelection(id: string, selection: IVideoFrameSelection) {
    if (!editable) return;

    getDriver().command.call("annotation.keyframe_add", { annotationId: id, selection });
  }

  async function deleteSelection(annotationId: string, frame: number) {
    if (!editable) return;

    getDriver().command.call("annotation.keyframe_delete", { annotationId, frame });
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

  function onEditValue(category: string | undefined, valueMode: string, properties?: AnnotationAttributes) {
    if (!editable) return;

    const effectiveProperties = properties ?? annotationValue.properties;
    let requirementFullfilled = requiredFullfilled(
      effectiveProperties,
      getDriver().getFilteredConfig(valueMode, { category, properties: effectiveProperties })?.properties,
    );

    if (valueMode == "entry:root" && !selAnnotation && entryRoot.value?.metadata?.id)
      selection.selectAnnotation(entryRoot.value as any);

    // wait for confirmation
    if (showPopOver) {
      // During creation (no selected annotation), store the value in pendingValue so
      // the SelectionPanel can display it and the Confirm button can read it.
      if (!selAnnotation) {
        pendingCategory = category;
        if (properties) pendingValue = properties;
      } else {
        selection.selectAnnotation({ ...selAnnotation, category, properties: effectiveProperties } as any);
      }
      return;
    }

    if (valueMode == "entry:root" && !selAnnotation) {
      if (category && category != "" && requirementFullfilled)
        addAnnotation({ type: valueMode }, category, $state.snapshot(effectiveProperties));
    } else if (selAnnotation) {
      selection.selectAnnotation({ ...selAnnotation, category, properties: effectiveProperties } as any);
      if (requirementFullfilled)
        updateAnnotationValue($state.snapshot(selAnnotation), category, $state.snapshot(effectiveProperties));
    } else if (selGroup) {
      // Update category for all annotations in the group
      getDriver().command.call("annotation.updateGroupCategory", {
        groupId: selGroup.groupId,
        categoryIdToBeUpdate: category,
      });
    } else if (valueMode !== "entry:root") {
      // Sidebar category click: store category and enter drawing mode
      pendingCategory = category;
      if (properties) pendingValue = properties;
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
    let attributes = $state.snapshot(pendingValue) as AnnotationAttributes;
    let category = pendingCategory;

    let shape: AnnotationShape = { type };
    shape = {
      ...shape,
      start: frame,
      end: frame,
      frames: [{ frame, angle, points }] as IVideoFrameSelection[],
    };

    shapeSelectionArgs = undefined;
    resetPending();
    addAnnotation(shape, category, attributes);
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
      let annotation_category_from = $state.snapshot(pendingCategory);
      let annotation_properties_from = $state.snapshot(pendingValue) as AnnotationAttributes;

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
        getDriver().config[type]?.values.some((v) => v.id == annotation_category_from) &&
        requiredFullfilled(
          annotation_properties_from,
          getDriver().getFilteredConfig(type, {
            category: annotation_category_from,
            properties: annotation_properties_from,
          })?.properties,
        )
      ) {
        shapeSelectionArgs = undefined;
        resetPending();
        addAnnotation(shape, annotation_category_from, annotation_properties_from);
      } else {
        shapeSelectionArgs = [type, frame, _points, angle, selectedId];
        // Keep pendingValue so the popover shows the selected category
        showPopOver = true;
      }
    } else {
      addSelection(selectedId, { frame, angle, points });
    }
  }

  function updateAnnotationValue(ann: IVideoAnnotationRecord, category?: string, properties?: AnnotationAttributes) {
    if (!editable) return;
    if (ann && annotation.isLocked(ann)) return;

    getDriver().command.call("annotation.update", { annotation: ann, category, properties });
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

  // Derive viewport annotations from the global store
  let viewportAnnotations = $derived.by<IVideoAnnotationRecord[]>(() => {
    const raw = data.annotations?.items ?? [];
    return raw.map((ann) => ({
      id: ann.id,
      shape_type: ann.shape_type,
      shape_args: ann.shape_args as IVideoAnnotationShape,
      category: ann.category || "null",
      properties: ann.properties ?? {},
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
    onEditValue(reselectedCategoryId, mode);
  }
</script>

<div class="relative flex h-full w-full flex-col">
  <Popover
    open={showPopOver}
    onOpenChange={(open: boolean) => {
      if (!open && showPopOver) {
        // Popover closed via Escape/click-outside — restore drawing state
        resetPending();
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
        {#if pendingCategory}
          <SelectionPanel
            selectedCategory={pendingCategory}
            annotationValue={annotationValue}
            onSelectCategory={(selectedCategory) => {
              if (!selectedCategory) selectAnnotation();
              pendingCategory = selectedCategory;
              onEditValue(pendingCategory, mode);
            }}
            onEditValue={(value) =>
              value && onEditValue(value.category as string | undefined, mode, value.properties as Record<string, unknown>)}
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
            resetPending();
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
              case "entry:root":
                onShapeSelection("entry:root", viewport.video.currentFrame.value);
                break;
              default:
                if (shapeSelectionArgs && pendingCategory) confirmCreateAnnotation(...shapeSelectionArgs);
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
            <section id="video-section" class="flex h-full w-full flex-1">
              {#if mediaInfo}
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
                  <!-- container context ?-->
                  <Video
                    bind:this={player}
                    bind:element={player_container}
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
                </ShapesContainer>
              {/if}

              <PropertiesSidebar {annotationId} {annotationValue} {onEditValue} onReSelectCategory={reSelectCategory} />
            </section>
          </ResizablePane>
        </ResizablePaneGroup>
      </ResizablePane>

      <ResizableHandle withHandle />

      <ResizablePane defaultSize={25} minSize={20} maxSize={60}>
        <BottomPanel {viewportAnnotations} {length} bind:player volume={viewport.video.sound} />
      </ResizablePane>
    </ResizablePaneGroup>
  </div>
</div>

<DebugConsole />
<ContextMenu />
<ConfirmDialog />
