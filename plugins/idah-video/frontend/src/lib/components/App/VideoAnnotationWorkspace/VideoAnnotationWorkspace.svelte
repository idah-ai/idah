<script lang="ts">
  import { onMount } from "svelte";

  import { Button } from "$lib/components/ui/Button";
  import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandShortcut,
  } from "$lib/components/ui/Command";
  import { getShortcuts } from "$lib/components/ui/Kbd/utils";
  import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/Popover";
  import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "$lib/components/ui/Resizable";

  import { requiredFullfilled } from "$lib/components/App/PropertySelector";
  import { VIDEO_BOUNDING_BOX as IDAH_VIDEO_BOUNDING_BOX, VIDEO_POLYGON as IDAH_VIDEO_POLYGON } from "$idah/v2/video-types";
  import { viewport } from "$lib/state/viewport.svelte";
  import { media } from "$lib/state/media.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { entryRoot } from "$lib/state/entry-root.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { ui } from "$lib/state/ui.svelte";
  import Highlight from "$lib/components/ui/Highlight.svelte";
  import DebugConsole from "$lib/components/App/DebugConsole.svelte";
  import { data } from "$lib/state/data.svelte";
  import {
    findClosestAnnotationInGroup,
    groupAnnotations,
  } from "$lib/components/App/VideoAnnotationWorkspace/utils/group-annotation.svelte";

  import BottomPanel from "$lib/components/App/BottomPanel/BottomPanel.svelte";
  import AnnotationSidebar from "$lib/components/App/CategorySelector/AnnotationCategorySelector.svelte";
  import PropertiesSidebar from "$lib/components/App/CategorySelector/PropertiesCategorySelector.svelte";
  import PropertySelector from "$lib/components/App/PropertySelector/PropertySelector.svelte";
  import ContextMenu from "$lib/components/App/ContextMenu/ContextMenu.svelte";
  import ShapesContainer, { type OnAddNewNoteParams } from "$lib/components/App/Viewport/ShapesV2/ShapesContainer.svelte";
  import Video from "$lib/components/App/Viewport/Video.svelte";

  import type { IVideoAnnotationRecord, IVideoAnnotationShape, IVideoFrameSelection } from "$idah/v2/video-types";
  import type { Point } from "$lib/utils/math/point";

  // Local type aliases for V1-compatible annotation shapes/values
  type AnnotationShape = Record<string, unknown> & { type: string; start?: number; end?: number };
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
  let selGroup = $derived(
    selection.value?.type === "group" ? selection.value : undefined,
  );

  // Variables
  const editableWorkflowSteps = ["annotate", "review"];
  const notableWorkflowSteps = ["annotate", "review", "done"];

  let entryId = $derived(getDriver().id);
  let mediaUrl = $derived(media.url);
  let workflowStep = $derived(getDriver().workflowStep);
  let mediaInfo: { meta: Record<string, unknown> } | undefined = $state(undefined);
  let editable = $derived<boolean>(editableWorkflowSteps.includes(workflowStep));
  let notable = $derived<boolean>(notableWorkflowSteps.includes(workflowStep));
  let isNoteMode = $derived(mode === "note");

  let player: Video | undefined = $state();
  let player_container: HTMLDivElement | undefined = $state();

  let annotationSidebarResizablePercentage = $state<number>(16);
  let annotationSidebarWidthRem = $derived<number>(annotationSidebarResizablePercentage + 3);

  let annotationId = $derived<string | undefined>(selAnnotation ? selAnnotation.metadata?.id : undefined);
  let annotationValue: AnnotationValue = $derived(selAnnotation?.value || {});

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
  let paletteSearchValue = $state("");

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
      }
    };

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  });

  $effect(() => {
    getDriver().setMode(viewport.mode);
  });

  onMount(async () => {
    const driver = getDriver();
    const meta = driver.media.meta;
    mediaInfo = { meta };

    const totalFrames = Math.round((meta.duration as number) * (meta.fps as number));
    length = totalFrames;
    viewport.timeline.range.startRange = 0;
    viewport.timeline.range.endRange = totalFrames;
    viewport.video.currentFrame.value = 1;

    // annotations are now derived from the global data store
    // The store is already preloaded in initDataStores()

    // Find entry-root annotation from the global store
    const entryRootAnnotation = (data.annotations?.items ?? []).find(
      (ann) => (ann.shape as any).type === "entry:root",
    );
    if (entryRootAnnotation) entryRoot.set(entryRootAnnotation);

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

  function seekToFrame(frame: number) {
    player?.seekToFrame(frame);
  }

  async function addAnnotation(shape: AnnotationShape, value: AnnotationValue = {}) {
    if (!editable) return;

    const { type, start, end, frames } = shape;
    const videoShape: IVideoAnnotationShape = { type, start: start!, end: end!, frames: frames as IVideoFrameSelection[] };

    getDriver().command.call("annotation.add", { shape: videoShape, value });

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

    getDriver().command.call("keyframe.add", { id, selection });
  }

  async function deleteSelection(annotationId: string, frame: number) {
    if (!editable) return;

    getDriver().command.call("keyframe.delete", { annotationId, frame });
  }

  function deleteAnnotation(annotation: IVideoAnnotationRecord, frame?: number) {
    if (!editable) return;

    if (frame != undefined) {
      deleteSelection(annotation.metadata!.id, frame);
    } else {
      removeAnnotation(annotation.metadata!.id);
    }
  }

  let shapeSelectionArgs:
    | [type: string, frame: number, _points: Point[], angle: number, selectedId?: string]
    | undefined = $state();

  function onEditValue(value: AnnotationValue, valueMode: string) {
    if (!editable) return;

    let requirementFullfilled = requiredFullfilled(value, getDriver().config[valueMode]?.properties);
    annotationValue = value;
    getDriver()?.setMode(valueMode);
    if (valueMode == "entry:root" && !selAnnotation && $entryRoot?.metadata.id) selection.selectAnnotation($entryRoot as any);

    // wait for confirmation
    if (showPopOver) {
      if (selAnnotation)
        selection.selectAnnotation({ ...selAnnotation, value: annotationValue } as any);
    } else {
      if (valueMode == "entry:root" && !selAnnotation) {
        if (value.category && value.category != "" && requirementFullfilled)
          addAnnotation({ type: valueMode }, $state.snapshot(value));
      } else if (selAnnotation) {
        selection.selectAnnotation({ ...selAnnotation, value: annotationValue } as any);
        if (requirementFullfilled) updateAnnotationValue($state.snapshot(selAnnotation), $state.snapshot(value));
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
      if (selGroup) {
        const closest = selectClosestAnnotation(selGroup as any, frame);
        addSelection(closest.metadata!.id, { frame, angle, points });
        return;
      }

      let annotation_value_from = $state.snapshot(annotationValue) as AnnotationValue;

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
        requiredFullfilled(annotation_value_from, getDriver().config[type]?.properties)
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

  function updateAnnotationValue(annotation: IVideoAnnotationRecord, value: AnnotationValue) {
    if (annotation?.locked || !editable) return;

    getDriver().command.call("annotation.update", { annotation, value });
  }

  function selectAnnotation(annotation?: IVideoAnnotationRecord) {
    if (annotation) {
      selection.selectAnnotation(annotation as any);
    } else {
      selection.deselect();
    }

    /**
     * Set mode to the annotation shape type when selecting an annotation
     */
    if (isNoteMode) {
      return;
    } else if (annotation?.shape.type && editable) {
      getDriver()?.setMode(annotation.shape.type);
    } else {
      getDriver()?.setMode("default");
    }
    if (selAnnotation) {
      selection.selectGroup(selAnnotation.metadata.metadata?.group_id || selAnnotation.metadata.id);
    }
  }

  function selectAnnotationGroup(annotationGroup: AnnotationGroup<IVideoAnnotationRecord>, selectedFrame?: number) {
    selection.selectGroup(annotationGroup.groupId);

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
        getDriver()?.setMode(firstAnnotation.shape.type);
        const closestAnnotation = selectClosestAnnotation(annotationGroup, selectedFrame);
      } else {
        getDriver()?.setMode("default");
        selection.deselect();
      }
    } else {
      selectAnnotation(undefined);
      getDriver()?.setMode("default");
    }
  }

  function selectClosestAnnotation(annotationGroup: AnnotationGroup<IVideoAnnotationRecord>, frame: number) {
    const closestAnnotation = findClosestAnnotationInGroup({
      annotationGroup,
      frame,
    });
    getDriver()?.setMode(closestAnnotation.shape.type);
    selectAnnotation(closestAnnotation);

    return closestAnnotation;
  }

  function setAnnotationFrame(frame: number) {
    if (!selGroup) return;

    const annotationGroups = groupAnnotations(viewportAnnotations);

    // Find the annotation group to get all annotations in the group
    const newSelectedAnnotationGroup = annotationGroups.find(
      (group) => group.groupId === selGroup?.groupId,
    );

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
      shape: ann.shape as IVideoAnnotationShape,
      value: {
        category: ann.value?.category || "null",
        attributes: ann.value?.attributes ?? {},
      },
      metadata: ann.metadata ?? {
        id: ann.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      },
      hidden: ann.hidden ?? false,
      locked: ann.locked ?? false,
      synced: ann.synced ?? true,
    })) as IVideoAnnotationRecord[];
  });

  let annotations_promise: Promise<IVideoAnnotationRecord[]> = $derived.by(() => {
    if (!data.annotations) return new Promise(() => {});
    return Promise.resolve(viewportAnnotations);
  });

  function showNewNotePopup(params: OnAddNewNoteParams) {
    const { anchorType, position, annotationId } = params;
    getDriver().notes.create({
      id: "",
      annotation_id: annotationId ?? null,
      content_md: "",
      anchor_type: anchorType,
      position: {
        ...position,
        sidebar_width: annotationSidebarWidthRem * 16,
      },
      resolved: false,
    });
  }

  async function reSelectCategory(reselectedCategoryId: string) {
    if (!selGroup) return;

    /** Update annotation group category */
    getDriver().command.call("annotation.updateGroupCategory", {
      groupId: selGroup.groupId,
      categoryIdToBeUpdate: reselectedCategoryId,
    });

    // Update the currently selected annotation value to reflect the category change in the properties sidebar
    onEditValue({ category: reselectedCategoryId }, mode);
  }
</script>

<div class="relative flex h-full w-full flex-col">
  {#key [selAnnotation]}
    <!-- All available commands -->
    <CommandDialog bind:open={ui.isCommandDialogOpen} accesskey={mode} bind:value={paletteSearchValue}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {#each Array.from(getDriver().command.getAllCommands().entries()) as [groupName, cmds]}
          <CommandGroup heading={groupName}>
            {#each cmds.filter((c) => c.shortDescription) as cmd (cmd.name)}
              <CommandItem
                onSelect={() => { getDriver().command.call(cmd.name); ui.isCommandDialogOpen = false; }}
              >
                <span>
                  <Highlight text={cmd.shortDescription} query={paletteSearchValue} />
                </span>
                <CommandShortcut>
                  {#if cmd.shortcut}
                    {getShortcuts([cmd.shortcut])?.join(" or ")}
                  {/if}
                </CommandShortcut>
              </CommandItem>
            {/each}
          </CommandGroup>
        {/each}
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
                onShapeSelection("entry:root", viewport.video.currentFrame.value);
                break;
              default:
                if (shapeSelectionArgs) onShapeSelection(...shapeSelectionArgs);
            }
          }}
          disabled={shapeSelectionArgs == undefined && "entry:root" != mode}
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
              onSelectAnnotationGroup={(annotationGroup) => selectClosestAnnotation(annotationGroup, viewport.video.currentFrame.value)}
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
                      viewport.video.currentFrame.value = currentFrame;
                      setAnnotationFrame(currentFrame);
                    }}
                    onVolumeChange={(level: number, muted: boolean) => {
                      viewport.video.sound = { level: level, muted };
                    }}
                  />
                </ShapesContainer>
              {/if}

              <PropertiesSidebar
                {annotationId}
                {annotationValue}
                {onEditValue}
                onReSelectCategory={reSelectCategory}
              />
            </section>
          </ResizablePane>
        </ResizablePaneGroup>
      </ResizablePane>

      <ResizableHandle withHandle />

      <ResizablePane defaultSize={25} minSize={20} maxSize={60}>
        <BottomPanel
          {viewportAnnotations}
          {length}
          bind:player
          volume={viewport.video.sound}
          onSelectAnnotation={selectAnnotation}
        />
      </ResizablePane>
    </ResizablePaneGroup>
  </div>
</div>

<DebugConsole />
<ContextMenu />
