<script lang="ts">
  import { onMount } from "svelte";

  import { Button } from "$lib/components/ui/Button";
  import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/Popover";
  import { ResizablePane, ResizablePaneGroup } from "$lib/components/ui/Resizable";

  import { requiredFullfilled } from "$lib/components/App/SelectionPanel";
  import { annotation } from "$lib/state/annotation.svelte";
  import { data } from "$lib/state/data.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { entryRoot } from "$lib/state/entry-root.svelte";
  import { media } from "$lib/state/media.svelte";
  import { DEFAULT_MODE, IMAGE_BOUNDING_BOX as IDAH_IMAGE_BOUNDING_BOX, IMAGE_CIRCLE as IDAH_IMAGE_CIRCLE, IMAGE_ELLIPSE as IDAH_IMAGE_ELLIPSE, IMAGE_LINE as IDAH_IMAGE_LINE, IMAGE_POLYGON as IDAH_IMAGE_POLYGON, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_LINE, IMAGE_POLYGON, IMAGE_MASK, NOTE_MODE, REVIEW_MODE } from "$lib/types";

  import AnnotationSidebar from "$lib/components/App/CategorySelector/AnnotationCategorySelector.svelte";
  import PropertiesSidebar from "$lib/components/App/CategorySelector/PropertiesCategorySelector.svelte";
  import ConfirmDialog from "$lib/components/App/ConfirmDialog/ConfirmDialog.svelte";
  import ContextMenu from "$lib/components/App/ContextMenu/ContextMenu.svelte";
  import DebugConsole from "$lib/components/App/DebugConsole.svelte";
  import SelectionPanel from "$lib/components/App/SelectionPanel/SelectionPanel.svelte";
  import Image from "$lib/components/App/Viewport/Image.svelte";
  import ShapesContainer, { type OnAddNewNoteParams } from "$lib/components/App/Viewport/Shapes/ShapesContainer.svelte";
  import { draft as polygonDraft } from "$lib/commands/annotation/polygon.add_point.svelte";
  import { lineDraft } from "$lib/commands/annotation/line.add_point.svelte";

  import type { IImageAnnotationRecord, IImageAnnotationShape } from "$lib/types";
  import type { Point } from "$lib/utils/math/point";
  import { viewport } from "$lib/state/viewport.svelte";
  import { syncStatus } from "$lib/state/driver.svelte";
  import { maskTool } from "$lib/state/mask-tool.svelte";
    import { maskSession } from "$lib/state/mask-session.svelte";

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

  /** Pending annotation (shape + value) waiting for category confirmation. */
  let pendingAnnotation = $derived.by<IImageAnnotationRecord | undefined>(() => {
    if (!shapeSelectionArgs) return undefined;
    const [type, points, extraProps] = shapeSelectionArgs;
    return {
      id: "pending",
      shape: { type, points, ...extraProps } as IImageAnnotationShape,
      value: { ...pendingValue },
      metadata: {},
      synced: true,
    } as IImageAnnotationRecord;
  });

  /** Category color for the create-shape previews — uses the selected category from the toolbar or popover. */
  let categoryColor = $derived.by<string | undefined>(() => {
    if (!pendingValue.category) return undefined;
    // Determine the active shape type — during drawing it's viewport.mode, during popover it's from shapeSelectionArgs
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

    // Reset pendingValue when getting out of drawing modes,
    // to avoid stale pendingValue when user switches back to drawing mode later
    if (viewportMode !== IMAGE_BOUNDING_BOX && viewportMode !== IMAGE_CIRCLE && viewportMode !== IMAGE_ELLIPSE && viewportMode !== IMAGE_LINE && viewportMode !== IMAGE_POLYGON && viewportMode !== IMAGE_MASK) {
      pendingValue = {};
    }

    // When leaving mask mode (e.g. returning to DEFAULT_MODE), clear the
    // session buffer so any in-progress stroke doesn't remain visible.
    if (viewportMode !== IMAGE_MASK) {
      maskSession.reset();
    }

    // Deselect group or annotation when switching to drawing modes,
    // but keep the selection if it's a mask annotation (so we can edit it).
    if (viewport.isCreationMode) {
      const sel = selection.value;
      if (!sel || (sel.shape as any)?.type !== IMAGE_MASK) {
        selection.deselect();
      }
    }
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
        name: "tools.circle",
        label: "Circle",
        type: IDAH_IMAGE_CIRCLE,
        iconName: "circle",
        disabled: !editable,
        command: "tools.circle",
      },
      {
        name: "tools.ellipse",
        label: "Ellipse",
        type: IDAH_IMAGE_ELLIPSE,
        iconName: "ellipse",
        disabled: !editable,
        command: "tools.ellipse",
      },
      {
        name: "tools.line",
        label: "Line",
        type: IDAH_IMAGE_LINE,
        iconName: "minimize-2",
        disabled: !editable,
        command: "tools.line",
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
      if ([IDAH_IMAGE_BOUNDING_BOX, IDAH_IMAGE_CIRCLE, IDAH_IMAGE_ELLIPSE, IDAH_IMAGE_LINE, IDAH_IMAGE_POLYGON].includes(tool.type)) {
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
    | [type: string, _points: Point[], extraProps: Record<string, unknown>|undefined]
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
      // ── Resolve the actual shape type from config ────────────────────
      // The valueMode may be DEFAULT_MODE (popover/right sidebar flow), but
      // the category might belong to a mask config. Resolve by checking if
      // the category ID exists in the IMAGE_MASK config values.
      const effectiveShapeType = (() => {
        if (valueMode === IMAGE_MASK) return IMAGE_MASK;
        if (value.category) {
          const maskConfig = getDriver().config[IMAGE_MASK];
          if (maskConfig?.values?.some((v: any) => v.id === value.category)) {
            return IMAGE_MASK;
          }
        }
        return valueMode;
      })();

      // ── Mask category: prevent duplicates ───────────────────────────
      // If a mask annotation with this category already exists, select it
      // instead of entering drawing mode, and enter mask mode with brush
      // so the user can continue editing. Only one mask per category.
      if (effectiveShapeType === IMAGE_MASK && value.category) {
        const existingMask = data.annotations?.items.find(
          (a) =>
            (a.shape as any)?.type === IMAGE_MASK &&
            (a.value as any)?.category === value.category,
        );
        if (existingMask) {
          selection.selectAnnotation(existingMask as any);
          // Enter mask mode with brush active so the user can edit
          viewport.mode = IMAGE_MASK;
          maskTool.active = "brush";
          return;
        }
      }

      // Sidebar category click: store category and enter drawing mode
      pendingValue = value;
      viewport.mode = valueMode;
      // When entering mask mode from sidebar, activate brush by default
      if (valueMode === IMAGE_MASK) {
        maskTool.active = "brush";
      }
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
    _extraProps: Record<string, unknown> = {},
  ) {
    if (!editable || isNoteMode) return;

    let points = $state.snapshot(_points) as Point[];
    let value = $state.snapshot(pendingValue) as AnnotationValue;

    const shape: IImageAnnotationShape = { type, points, ..._extraProps };

    shapeSelectionArgs = undefined;
    pendingValue = {};
    addAnnotation(shape, value);
  }

  function onShapeSelection(
    type: string,
    _points: Point[] = [],
    extraProps?: Record<string, unknown>,
    selectedId?: string,
  ) {
    if (!editable || isNoteMode) return;

    let points = $state.snapshot(_points) as Point[];

    // If selectedId is provided, this is a shape edit on an existing annotation.
    if (selectedId) {
      const ann = data.annotations?.items.find((a) => a.id === selectedId);
      if (!ann || annotation.isLocked(ann)) return;

      const shapeData = ann.shape as IImageAnnotationShape;
      const shapeType = shapeData?.type ?? type;
      const updatedShape: IImageAnnotationShape = { type: shapeType, points, ...extraProps };
      getDriver().command.call("annotation.update", {
        annotation: ann,
        shape: updatedShape,
      });
      return;
    }

    let annotation_value_from = $state.snapshot(pendingValue) as AnnotationValue;

    const shape: IImageAnnotationShape = { type, points, ...extraProps };

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
      shapeSelectionArgs = [type, _points, extraProps];
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
      if (!open && showPopOver) {
        // Popover closed via Escape/click-outside — restore drawing state
        annotationValue = {};
        pendingValue = {};
        const args = shapeSelectionArgs;
        shapeSelectionArgs = undefined;
        if (args) {
          const [type, points] = args;
          if (type === IMAGE_POLYGON) {
            polygonDraft.points = points;
            viewport.mode = IMAGE_POLYGON;
          } else if (type === IMAGE_LINE) {
            lineDraft.points = points;
            viewport.mode = IMAGE_LINE;
          } else if (type === IMAGE_MASK) {
            // Restore mask mode without resetting the session buffer,
            // so any in-progress paint stroke is preserved.
            viewport.mode = IMAGE_MASK;
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
            // Restore the drawing state so the user can continue editing
            const args = shapeSelectionArgs;
            shapeSelectionArgs = undefined;
            if (args) {
              const [type, points] = args;
              if (type === IMAGE_POLYGON) {
                polygonDraft.points = points;
                viewport.mode = IMAGE_POLYGON;
              } else if (type === IMAGE_LINE) {
                lineDraft.points = points;
                viewport.mode = IMAGE_LINE;
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
                  {pendingAnnotation}
                  {categoryColor}
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
