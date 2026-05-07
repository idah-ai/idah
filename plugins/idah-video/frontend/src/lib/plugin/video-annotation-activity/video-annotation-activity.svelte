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
  import {
    registerOnSelectShortcuts,
    registerShortcuts,
    registerShortcutsReference,
  } from "$lib/plugin/video-annotation-activity/shortcut";
  import { entryRoot } from "$lib/plugin/video-annotation-activity/store/idb-store.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { media } from "$lib/state/media.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { uiStore } from "$lib/plugin/video-annotation-activity/store/ui-store.svelte";
  import DebugConsole from "$lib/components/App/DebugConsole.svelte";
  import { data } from "$lib/state/data.svelte";
  import {
    findClosestAnnotationInGroup,
    groupAnnotations,
  } from "$lib/plugin/video-annotation-activity/utils/group-annotation.svelte";

  import BottomPanel from "$lib/components/App/BottomPanel/BottomPanel.svelte";
  import AnnotationSidebar from "$lib/components/App/CategorySelector/AnnotationCategorySelector.svelte";
  import PropertiesSidebar from "$lib/components/App/CategorySelector/PropertiesCategorySelector.svelte";
  import PropertySelector from "$lib/components/App/PropertySelector/PropertySelector.svelte";
  import ContextMenu from "$lib/components/App/ContextMenu/ContextMenu.svelte";
  import SvgOverlay, { type OnAddNewNoteParams } from "$lib/components/App/Viewport/SvgOverlay.svelte";
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

  let entryId = $derived(context.id);
  let mediaUrl = $derived(context.mediaUrl);
  let workflowStep = $derived(context.workflowStep);
  let mediaInfo: IMedia | undefined = $state(undefined);
  let editable = $derived<boolean>(editableWorkflowSteps.includes(workflowStep));
  let notable = $derived<boolean>(notableWorkflowSteps.includes(workflowStep));
  let isNoteMode = $derived(mode === IDAH_NOTE);

  let player: Video | undefined = $state();
  let player_container: HTMLDivElement | undefined = $state();

  let annotationSidebarResizablePercentage = $state<number>(16);
  let annotationSidebarWidthRem = $derived<number>(annotationSidebarResizablePercentage + 3);

  let annotationId = $derived<string | undefined>(selAnnotation ? selAnnotation.metadata.id : undefined);
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
    context.tools.setTool(mode);
  });

  onMount(async () => {
    mediaInfo = await context.mediaInfo();

    const totalFrames = Math.round((mediaInfo.meta.duration as number) * (mediaInfo.meta.fps as number));
    length = totalFrames;
    viewport.timeline.range.startRange = 0;
    viewport.timeline.range.endRange = totalFrames;
    viewport.video.currentFrame.value = 1;

    // Generate the full static reference list of shortcuts and register them to the shared context
    registerShortcutsReference(context);

    // annotations are now derived from the global store

    // Load annotations directly from the context (V2 data-store backed)
    try {
      const v1Annotations = await context.annotations.list({}, { page: 1, itemsPerPage: 10000 });
      const annotations = v1Annotations.map((ann) => {
        const v2shape = ann.dimensions as VideoShape;
        return {
          shape: {
            ...v2shape,
            frames: v2shape.frames ?? [],
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
        } as VideoAnnotationObject;
      });

      const entryRootAnnotation = annotations.find((a) => a.shape.type === ENTRY_ROOT);
      if (entryRootAnnotation) $entryRoot = entryRootAnnotation;
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
    getDriver()?.setMode(valueMode);
    if (valueMode == ENTRY_ROOT && !selAnnotation && $entryRoot?.metadata.id) selection.selectAnnotation($entryRoot as any);

    // wait for confirmation
    if (showPopOver) {
      if (selAnnotation)
        selection.selectAnnotation({ ...selAnnotation, value: annotationValue } as any);
    } else {
      if (valueMode == ENTRY_ROOT && !selAnnotation) {
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
      // Register selection-specific shortcuts for the current mode
      registerOnSelectShortcuts(annotation.shape.type, {
        commands: context.commands,
        selectedId: annotation.metadata.id,
        selectedGroupId: annotation.metadata.metadata?.group_id || selGroup?.groupId,
        getCurrentFrame: () => viewport.video.currentFrame.value,
      });
    } else {
      getDriver()?.setMode(DEFAULT_MODE);
    }
    if (selAnnotation) {
      selection.selectGroup(selAnnotation.metadata.metadata?.group_id || selAnnotation.metadata.id);
    }
  }

  function selectAnnotationGroup(annotationGroup: AnnotationGroup<VideoAnnotationObject>, selectedFrame?: number) {
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

        /** Register selection-specific shortcuts for the current mode with closest annotation id */
        registerOnSelectShortcuts(firstAnnotation.shape.type, {
          commands: context.commands,
          selectedId: closestAnnotation.metadata.id,
          selectedGroupId: annotationGroup.groupId,
          getCurrentFrame: () => viewport.video.currentFrame.value,
        });
      } else {
        getDriver()?.setMode(DEFAULT_MODE);
        selection.deselect();
        /** Register selection-specific shortcuts for the current mode with non selectedId */
        registerOnSelectShortcuts(firstAnnotation.shape.type, {
          commands: context.commands,
          selectedId: undefined,
          selectedGroupId: annotationGroup.groupId,
          getCurrentFrame: () => viewport.video.currentFrame.value,
        });
      }
    } else {
      selectAnnotation(undefined);
      getDriver()?.setMode(DEFAULT_MODE);
    }
  }

  function selectClosestAnnotation(annotationGroup: AnnotationGroup<VideoAnnotationObject>, frame: number) {
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

      if (closestAnnotation.metadata.id === selAnnotation?.metadata.id) {
        return;
      }

      selection.selectAnnotation(closestAnnotation as any);
      selection.selectGroup(newSelectedAnnotationGroup.groupId);
    }
  }

  // Derive viewport annotations from the global store
  let viewportAnnotations = $derived.by<VideoAnnotationObject[]>(() => {
    const raw = data.annotations?.items ?? [];
    return raw.map((ann) => ({
      shape: ann.shape as VideoShape,
      value: {
        category: (ann.category ?? ann.value?.category) || "null",
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
    })) as VideoAnnotationObject[];
  });

  let annotations_promise: Promise<VideoAnnotationObject[]> = $derived.by(() => {
    if (!data.annotations) return new Promise(() => {});
    return Promise.resolve(viewportAnnotations);
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
    if (!selGroup) return;

    /** Update annotation group category */
    context.commands.run("annotation.updateGroupCategory", {
      groupId: selGroup.groupId,
      categoryIdToBeUpdate: reselectedCategoryId,
    });

    // Update the currently selected annotation value to reflect the category change in the properties sidebar
    onEditValue({ category: reselectedCategoryId }, mode);
  }
</script>

<div class="relative flex h-full w-full flex-col">
  {#key [ShortcutManager, ShortcutManager.currentMode, ShortcutManager.getCurrentMode(), selAnnotation]}
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
            switch (mode) {
              case ENTRY_ROOT:
                onShapeSelection(ENTRY_ROOT, viewport.video.currentFrame.value);
                break;
              default:
                if (shapeSelectionArgs) onShapeSelection(...shapeSelectionArgs);
            }
          }}
          disabled={shapeSelectionArgs == undefined && ENTRY_ROOT != mode}
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
                  frame={viewport.video.currentFrame.value}
                  onSelectAnnotation={selectAnnotation}
                  onSelection={onShapeSelection}
                  onAddNewNote={showNewNotePopup}
                  onChangeFrame={seekToFrame}
                  target_container={() => player_container}
                  {videoResizedAt}
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
                      videoResizedAt = new Date();
                    }}
                    onFrameUpdate={(currentFrame: number) => {
                      viewport.video.currentFrame.value = currentFrame;
                      setAnnotationFrame(currentFrame);
                    }}
                    onVolumeChange={(level: number, muted: boolean) => {
                      viewport.video.sound = { level: level, muted };
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
        <BottomPanel
          {context}
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
