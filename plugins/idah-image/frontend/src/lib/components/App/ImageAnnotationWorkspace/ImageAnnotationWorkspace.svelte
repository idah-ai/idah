<script lang="ts">
  import { onMount } from "svelte";

  import { Button } from "$lib/components/ui/Button";
  import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/Popover";
  import { ResizablePane, ResizablePaneGroup } from "$lib/components/ui/Resizable";

  import { requiredFullfilled } from "$lib/components/App/SelectionPanel";
  import { annotation } from "$lib/state/annotation.svelte";
  import { data } from "$lib/state/data.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { entryRoot } from "$lib/state/entry-root.svelte";
  import { media } from "$lib/state/media.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { IMAGE_BOUNDING_BOX as IDAH_IMAGE_BOUNDING_BOX, IMAGE_POLYGON as IDAH_IMAGE_POLYGON, IMAGE_BOUNDING_BOX, IMAGE_POLYGON, NOTE_MODE, REVIEW_MODE } from "$lib/types";

  import AnnotationSidebar from "$lib/components/App/CategorySelector/AnnotationCategorySelector.svelte";
  import PropertiesSidebar from "$lib/components/App/CategorySelector/PropertiesCategorySelector.svelte";
  import ConfirmDialog from "$lib/components/App/ConfirmDialog/ConfirmDialog.svelte";
  import ContextMenu from "$lib/components/App/ContextMenu/ContextMenu.svelte";
  import DebugConsole from "$lib/components/App/DebugConsole.svelte";
  import SelectionPanel from "$lib/components/App/SelectionPanel/SelectionPanel.svelte";
  import Image from "$lib/components/App/Viewport/Image.svelte";
  import ShapesContainer, { type OnAddNewNoteParams } from "$lib/components/App/Viewport/Shapes/ShapesContainer.svelte";

  import type { IImageAnnotationRecord, IImageAnnotationShape } from "$lib/types";
  import type { Point } from "$lib/utils/math/point";
  import { viewport } from "$lib/state/viewport.svelte";

  // Local type aliases for V1-compatible annotation values
  type AnnotationValue = Record<string, unknown> & { category?: string; attributes?: Record<string, unknown> };

  // Local derived aliases for V2 state
  let mode = $derived(viewport.mode);
  let selAnnotation = $derived(selection.value);

  // Variables
  const editableWorkflowSteps = ["annotate", "review"];
  const notableWorkflowSteps = ["annotate", "review", "done"];

  let entryId = $derived(getDriver().id);
  let mediaUrl = $derived(media.url);
  let workflowStep = $derived(getDriver().workflowStep);
  let mediaInfo: { meta: Record<string, unknown> } | undefined = $state(undefined);
  let editable = $derived<boolean>(editableWorkflowSteps.includes(workflowStep));
  let notable = $derived<boolean>(notableWorkflowSteps.includes(workflowStep));
  let isNoteMode = $derived(mode === NOTE_MODE);

  // let image: Image | undefined = $state();
  // let image_container: HTMLDivElement | undefined = $state();
  let image_container: HTMLImageElement | undefined = $state();

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

    if (mode === "entry:root") {
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
  $effect(() => {
    if (typeof window === "undefined") return;

    const handleKeydown = (e: KeyboardEvent) => {
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

    // Reset pendingValue when getting out of drawing modes,
    // to avoid stale pendingValue when user switches back to drawing mode later
    if (viewportMode !== IMAGE_BOUNDING_BOX && viewportMode !== IMAGE_POLYGON) {
      pendingValue = {};
    }

    // Deselect group or annotation when switching to drawing modes
    if (viewport.isCreationMode) selection.deselect();
  });

  onMount(async () => {
    const driver = getDriver();
    const meta = driver.media.meta;
    mediaInfo = { meta };

    const totalFrames = Math.round((meta.duration as number) * (meta.fps as number));
    length = totalFrames;

    viewport.image.currentFrame.value = 0;

    // annotations are now derived from the global data store
    // The store is already preloaded in initDataStores()

    // Find entry-root annotation from the global store
    const entryRootAnnotation = (data.annotations?.items ?? []).find((ann) => (ann.shape as any).type === "entry:root");
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
        type: IDAH_IMAGE_BOUNDING_BOX,
        iconName: "vector-square",
        disabled: !editable,
        command: "tools.bounding_box",
      },
      {
        name: "tools.polygon",
        label: "Polygon",
        type: IDAH_IMAGE_POLYGON,
        iconName: "polygon",
        disabled: !editable,
        command: "tools.polygon",
      },
      {
        name: "tools.note",
        label: "Add Note",
        type: NOTE_MODE,
        iconName: "message-circle",
        disabled: !notable, // Note: Only allow to create note when workflow steps are "annotate" and REVIEW_MODE
        command: "tools.note",
      },
    ];

    const toolConfig = toolListConfig.filter((tool) => {
      if ([IDAH_IMAGE_BOUNDING_BOX, IDAH_IMAGE_POLYGON].includes(tool.type)) {
        return !!getDriver().config[tool.type];
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

  async function addAnnotation(shape: IImageAnnotationShape, value: AnnotationValue = {}) {
    if (!editable) return;

    getDriver().command.call("annotation.add", { shape, value });

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

  function deleteAnnotation(annotation: IImageAnnotationRecord) {
    if (!editable) return;
    removeAnnotation(annotation.metadata!.id as string);
  }

  let shapeSelectionArgs:
    | [type: string, _points: Point[], angle: number]
    | undefined = $state();

  function onEditValue(value: AnnotationValue, valueMode: string) {
    if (!editable) return;

    let requirementFullfilled = requiredFullfilled(
      value,
      getDriver().getFilteredConfig(valueMode, value as unknown as Record<string, unknown>)?.properties,
    );

    if (valueMode == "entry:root" && !selAnnotation && entryRoot.value?.metadata?.id)
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

    if (valueMode == "entry:root" && !selAnnotation) {
      if (value.category && value.category != "" && requirementFullfilled)
        addAnnotation({ type: valueMode } as IImageAnnotationShape, $state.snapshot(value));
    } else if (selAnnotation) {
      selection.selectAnnotation({ ...selAnnotation, value: annotationValue } as any);
      if (requirementFullfilled) updateAnnotationValue($state.snapshot(selAnnotation) as unknown as IImageAnnotationRecord, $state.snapshot(value));
    } else if (valueMode !== "entry:root") {
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
    _points: Point[] = [],
    angle: number = 0,
  ) {
    if (!editable || isNoteMode) return;

    let points = $state.snapshot(_points) as Point[];
    let value = $state.snapshot(pendingValue) as AnnotationValue;

    const shape: IImageAnnotationShape = { type, points, angle };

    shapeSelectionArgs = undefined;
    pendingValue = {};
    addAnnotation(shape, value);
  }

  function onShapeSelection(
    type: string,
    _points: Point[] = [],
    angle: number = 0,
    selectedId?: string,
  ) {
    if (!editable || isNoteMode) return;

    let points = $state.snapshot(_points) as Point[];

    // If selectedId is provided, this is a shape edit on an existing annotation.
    // Derive the shape type from the annotation itself rather than the first
    // argument (viewport.mode), keeping the call signature aligned with video.
    if (selectedId) {
      const ann = data.annotations?.items.find((a) => a.id === selectedId);
      if (!ann || annotation.isLocked(ann)) return;

      const shapeType = (ann.shape as IImageAnnotationShape)?.type ?? type;
      const updatedShape: IImageAnnotationShape = { type: shapeType, points, angle };
      getDriver().command.call("annotation.update", {
        annotation: ann,
        shape: updatedShape,
      });
      return;
    }

    let annotation_value_from = $state.snapshot(pendingValue) as AnnotationValue;

    const shape: IImageAnnotationShape = { type, points, angle };

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
      shapeSelectionArgs = [type, _points, angle];
      // Keep pendingValue so the popover shows the selected category
      showPopOver = true;
    }
  }

  function updateAnnotationValue(ann: IImageAnnotationRecord, value: AnnotationValue) {
    if (!editable) return;
    if (ann && annotation.isLocked(ann)) return;

    getDriver().command.call("annotation.update", { annotation: ann, value });
  }

  function selectAnnotation(annotation?: IImageAnnotationRecord) {
    if (annotation) {
      selection.selectAnnotation(annotation as any);
    } else {
      selection.deselect();
    }
  }

  // Derive viewport annotations from the global store
  let viewportAnnotations = $derived.by<IImageAnnotationRecord[]>(() => {
    const raw = data.annotations?.items ?? [];
    return raw.map((ann) => ({
      id: ann.id,
      shape: ann.shape as IImageAnnotationShape,
      value: {
        category: ann.value?.category || "null",
        attributes: ann.value?.attributes ?? {},
      },
      metadata: ann.metadata ?? {},
      synced: ann.synced ?? true,
    })) as IImageAnnotationRecord[];
  });

  let annotations_promise: Promise<IImageAnnotationRecord[]> = $derived.by(() => {
    if (!data.annotations) return new Promise(() => {});
    return Promise.resolve(viewportAnnotations);
  });

  function showNewNotePopup(params: OnAddNewNoteParams) {
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
      showPopOver = open;
    }}
  >
    <PopoverTrigger></PopoverTrigger>

    <PopoverContent
      class="min-w-80 p-0"
      onkeydown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (!canConfirm) return;
          showPopOver = false;
          if (mode === "entry:root") {
            addAnnotation({ type: "entry:root" } as IImageAnnotationShape, $state.snapshot(pendingValue));
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
              case "entry:root":
                addAnnotation({ type: "entry:root" } as IImageAnnotationShape, $state.snapshot(pendingValue));
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

  <div id="plugin::idah-image" class="flex min-h-0 w-full flex-1">
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
              onDeleteAnnotation={deleteAnnotation}
            />
          </ResizablePane>

          <!--
            NOTE: Can not resize annotation sidebar,
            as it will affect the note overlay and svg overlay
            <ResizableHandle withHandle />
          -->

          <ResizablePane defaultSize={75}>
            <section id="image-section" class="flex h-full w-full flex-1">
              {#if mediaInfo}
                <ShapesContainer
                  bind:this={overlay}
                  {annotations_promise}
                  onSelectAnnotation={selectAnnotation}
                  onSelection={onShapeSelection}
                  onAddNewNote={showNewNotePopup}
                >
                  <!-- container context ?-->
                  <Image bind:element={image_container} src={mediaUrl}></Image>
                </ShapesContainer>
              {/if}

              <PropertiesSidebar {annotationId} {annotationValue} {onEditValue} onReSelectCategory={reSelectCategory} />
            </section>
          </ResizablePane>
        </ResizablePaneGroup>
      </ResizablePane>
    </ResizablePaneGroup>
  </div>
</div>

<DebugConsole />
<ContextMenu />
<ConfirmDialog />
