<script lang="ts">
  import { onMount, setContext } from "svelte";

  import ImageOverlay, { type OnAddNewNoteParams } from "$lib/components/app/overlay/image-overlay.svelte";
  import ImageAnnotationSidebar from "$lib/components/app/sidebar/image-annotation-sidebar.svelte";
  import ImagePropertiesSidebar from "$lib/components/app/sidebar/image-properties-sidebar.svelte";
  import CategoryProperties from "$lib/components/app/sidebar/properties/category-properties.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
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
  import PopoverContent from "$lib/components/ui/popover/popover-content.svelte";
  import PopoverTrigger from "$lib/components/ui/popover/popover-trigger.svelte";
  import Popover from "$lib/components/ui/popover/popover.svelte";
  import { ResizablePane } from "$lib/components/ui/resizable";
  import ResizableHandle from "$lib/components/ui/resizable/resizable-handle.svelte";
  import ResizablePaneGroup from "$lib/components/ui/resizable/resizable-pane-group.svelte";

  import { ShortcutManager } from "$lib/shortcut/shortcut-manager";

  import { requiredFullfilled } from "$lib/components/app/sidebar/properties/properties.index";
  import { registerCommands } from "$lib/plugin/commands.svelte";
  import { annotationsIndexedDB, type AnnotationBackend } from "$lib/plugin/data/annotation/annotaiton-backend.svelte";
  import { registerOnSelectShortcuts, registerShortcuts } from "$lib/plugin/shortcut";
  import { boundingBoxes, entryRoot, idbUpdatedAt, setIndexedDBUpdatedAt } from "$lib/plugin/store/idb-store.svelte";
  import {
    currentMode,
    selectedAnnotation,
    selectedAnnotationGroup,
    setCurrentModeTo,
    setSelectedAnnotation,
    setSelectedAnnotationGroup,
  } from "$lib/plugin/store/store";
  import {
    DEFAULT_MODE,
    EDITOR_MODE_TOOLS,
    ENTRY_ROOT,
    IMAGE_BOUNDING_BOX,
    IMAGE_NOTE,
    IMAGE_POLYGON,
  } from "$lib/plugin/types";

  import type { AnnotationGroup, AnnotationShape, AnnotationValue } from "$lib/context/annotation-context";
  import type { IActivityContext } from "$lib/context/context";
  import type {
    ImageAnnotationObject,
    ImageFrameSelection,
    ImageShape,
    Point,
  } from "$lib/context/image-annotation-context";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();

  // Contexts
  setContext("context", context);

  onMount(() => {
    console.log(context);
  });

  // Variables
  const editableWorkflowSteps = ["annotate", "review"];
  const notableWorkflowSteps = ["annotate", "review", "done"];

  let { id: entryId, workflowStep } = $derived(context);

  let editable = $derived<boolean>(editableWorkflowSteps.includes(workflowStep));
  let notable = $derived<boolean>(notableWorkflowSteps.includes(workflowStep));
  let isNoteMode = $derived($currentMode === IMAGE_NOTE);
  let tools: {
    label: string;
    type: string;
    iconName: string;
    disabled?: boolean;
    handleClick: () => void;
  }[] = $state([]);
  let showPopOver = $state(false);
  let annotationsIDB: AnnotationBackend | undefined = $state();

  let annotationId = $derived<string | undefined>($selectedAnnotation ? $selectedAnnotation.metadata.id : undefined);
  let annotationValue: AnnotationValue = $derived($selectedAnnotation?.value || {});

  let annotationSidebarResizablePercentage = $state<number>(16);
  let annotationSidebarWidthRem = $derived<number>(annotationSidebarResizablePercentage + 3);
  let overlay: ImageOverlay;
  let annotations_promise: Promise<ImageAnnotationObject[]> = $derived.by(() => {
    $idbUpdatedAt; // eslint-disable-line @typescript-eslint/no-unused-expressions

    if (!annotationsIDB) return new Promise((_, ko) => ko("no database"));

    let p = annotationsIDB.getAllStore("annotations");

    p.then((updatedAnnotations) => {
      $boundingBoxes = updatedAnnotations;
    });

    return p;
  });
  let player_container: HTMLDivElement | undefined = $state();
  let commandOpen = $state(false);
  let shapeSelectionArgs:
    | [type: string, frame: number, _points: Point[], angle: number, selectedId?: string]
    | undefined = $state();

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

  $effect(() => {
    context.tools.setTool($currentMode);
  });

  onMount(async () => {
    $boundingBoxes = [];

    try {
      annotationsIDB = await annotationsIndexedDB(["idah-image", "entry", entryId].join(":"));

      /** Register commands */
      registerCommands({
        context,
        getDb: () => annotationsIDB,
        updaters: {
          setAnnotationValue: (v) => (annotationValue = v),
          selectAnnotation: (v) => selectAnnotation(v),
        },
      });

      fetchAnnotations(annotationsIDB).then(() => {
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
        label: "Visual",
        type: DEFAULT_MODE,
        iconName: "mouse-pointer-2",
        command: "tools.visual",
      },
      {
        label: "Bounding Box",
        type: IMAGE_BOUNDING_BOX,
        iconName: "vector-square",
        disabled: !editable,
        command: "tools.bounding_box",
      },
      {
        label: "Polygon",
        type: IMAGE_POLYGON,
        iconName: "polygon",
        disabled: !editable,
        command: "tools.polygon",
      },
      {
        label: "Notes",
        type: IMAGE_NOTE,
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
      toggleCommandCB: () => {
        commandOpen = !commandOpen;
      },
      flush: () => context.annotations.flush(),
      switch_mode: (mode: string) => {
        const config = toolConfig.find((c) => c.type === mode) || toolListConfig[0];
        context.commands.run(config.command);
      },
    });

    function fetchAnnotations(db: AnnotationBackend, page = 1, itemsPerPage = 100): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        context.annotations.list({ entry_id: entryId }, { page, itemsPerPage }).then((res) => {
          let d = res.map((ann) => {
            const annotation: ImageAnnotationObject = {
              shape: {
                ...(ann.dimensions as ImageShape),
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

  async function addAnnotation(shape: AnnotationShape, value: AnnotationValue = {}) {
    if (!editable) return;

    const { type, start, end, frames } = shape;
    const imageShape: ImageShape = { type, start, end, frames, value };

    context.commands.run("annotation.add", { shape: imageShape, value });

    const timelineScrollAreaEl = document.getElementById("timeline-scroll-area");

    if (timelineScrollAreaEl) {
      const scrollContainer = timelineScrollAreaEl.querySelector(`[data-slot="scroll-area-viewport"]`) as HTMLElement;

      setTimeout(() => {
        // scroll to bottom most
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    }
  }

  async function removeAnnotation(annotationId: string) {
    if (!editable) return;

    context.commands.run("annotation.delete", { annotationId });
  }

  async function addSelection(id: string, selection: ImageFrameSelection) {
    if (!editable) return;

    context.commands.run("keyframe.add", { id, selection });
  }

  async function deleteSelection(annotationId: string, frame: number) {
    if (!editable) return;

    context.commands.run("keyframe.delete", { annotationId, frame });
  }

  function onEditValue(value: AnnotationValue, valueMode: string) {
    if (!editable) return;

    // let requirementFullfilled = requiredFullfilled(value, context.config[valueMode]?.properties);
    // annotationValue = value;
    // setCurrentModeTo(valueMode);
    // if (valueMode == ENTRY_ROOT && !$selectedAnnotation && $entryRoot?.metadata.id) $selectedAnnotation = $entryRoot;

    // // wait for confirmation
    // if (showPopOver) {
    //   if ($selectedAnnotation)
    //     $selectedAnnotation = {
    //       ...$selectedAnnotation,
    //       value: annotationValue,
    //     };
    // } else {
    //   if (valueMode == ENTRY_ROOT && !$selectedAnnotation) {
    //     if (value.category && value.category != "" && requirementFullfilled)
    //       addAnnotation({ type: valueMode }, $state.snapshot(value));
    //   } else if ($selectedAnnotation) {
    //     $selectedAnnotation = {
    //       ...$selectedAnnotation,
    //       value: annotationValue,
    //     };
    //     if (requirementFullfilled) updateAnnotationValue($state.snapshot($selectedAnnotation), $state.snapshot(value));
    //   } else if (shapeSelectionArgs && requirementFullfilled) {
    //     showPopOver = false;
    //     onShapeSelection(...shapeSelectionArgs);
    //   }
    // }
  }

  async function reSelectCategory(reselectedCategoryId: string) {
    if (!$selectedAnnotationGroup) return;

    /** Update annotation group category */
    context.commands.run("annotation.updateGroupCategory", {
      groupId: $selectedAnnotationGroup.groupId,
      categoryIdToBeUpdate: reselectedCategoryId,
    });
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
        case IMAGE_BOUNDING_BOX:
          shape = {
            ...shape,
            start: frame,
            end: frame,
            frames: [{ frame, angle, points }],
          };
          break;
        case IMAGE_POLYGON:
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

  function updateAnnotationValue(annotation: ImageAnnotationObject, value: AnnotationValue) {
    if (annotation?.locked || !editable) return;

    context.commands.run("annotation.update", { annotation, value });
  }

  function selectAnnotation(annotation?: ImageAnnotationObject) {
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

  function selectClosestAnnotation(annotationGroup: AnnotationGroup<ImageAnnotationObject>, frame: number) {
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

  function selectAnnotationGroup(annotationGroup: AnnotationGroup<ImageAnnotationObject>, selectedFrame?: number) {
    $selectedAnnotationGroup = annotationGroup;

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
      // registerOnSelectBoxModeShortcuts(context, undefined, annotationGroup.groupId, () => currentFrame);
    } else {
      selectAnnotation(undefined);
      setCurrentModeTo(DEFAULT_MODE);
    }
  }

  function setVisibility(hidden: boolean, annotation?: ImageAnnotationObject) {
    if (annotation) {
      annotation.hidden = hidden;
      if (annotation.metadata.id == $selectedAnnotation?.metadata.id) $selectedAnnotation.hidden = hidden;
      if (annotation.shape.type == ENTRY_ROOT) $entryRoot = annotation;

      annotationsIDB?.upsertAnnotations([annotation]).then(() => setIndexedDBUpdatedAt());
    } else {
      if ($selectedAnnotation) $selectedAnnotation.hidden = hidden;
      annotationsIDB?.updateAllVisibility(hidden).then(() => setIndexedDBUpdatedAt());
    }
  }

  function setEditability(locked: boolean, annotation?: ImageAnnotationObject) {
    if (annotation) {
      annotation.locked = locked;
      if (annotation.metadata.id == $selectedAnnotation?.metadata.id) $selectedAnnotation.locked = locked;
      if (annotation.shape.type == ENTRY_ROOT) $entryRoot = annotation;
      annotationsIDB?.upsertAnnotations([annotation]).then(() => setIndexedDBUpdatedAt());
    } else {
      if ($entryRoot) $entryRoot.locked = locked;
      if ($selectedAnnotation) $selectedAnnotation.locked = locked;
      annotationsIDB?.updateAllLock(locked).then(() => setIndexedDBUpdatedAt());
    }
  }

  function deleteAnnotation(annotation: ImageAnnotationObject, frame?: number) {
    if (!editable) return;

    // if (frame != undefined) {
    //   deleteSelection(annotation.metadata.id, frame);
    // } else {
    //   removeAnnotation(annotation.metadata.id);
    // }
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

  <!-- POPOVER -->
  <Popover
    open={showPopOver}
    onOpenChange={(open: boolean) => {
      showPopOver = open;
    }}
  >
    <PopoverTrigger />

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
          <ImageAnnotationSidebar
            view="popover"
            sidebarWidthRem={annotationSidebarWidthRem}
            db={annotationsIDB}
            {annotationValue}
            {context}
            onSelectAnnotation={selectAnnotation}
            onSelectAnnotationGroup={selectAnnotationGroup}
            onDeleteAnnotation={deleteAnnotation}
            onEditability={setEditability}
            onVisibility={setVisibility}
          />
        {/if}
      </div>

      <div class="flex justify-end gap-2 p-2">
        <Button size="sm" variant="outline" onclick={() => (showPopOver = false)}>Cancel</Button>

        <Button size="sm" onclick={() => (showPopOver = false)}>Confirm</Button>
      </div>
    </PopoverContent>
  </Popover>

  <!-- PLUGIN ROOT -->
  <div id="plugin::idah-image" class="flex min-h-0 w-full flex-1">
    <ResizablePaneGroup direction="vertical">
      <!-- MAIN AREA -->
      <ResizablePane defaultSize={60} minSize={15}>
        <ResizablePaneGroup direction="horizontal">
          <!-- LEFT SIDEBAR -->
          <ResizablePane minSize={14} defaultSize={20} maxSize={20}>
            <ImageAnnotationSidebar
              view="sidebar"
              sidebarWidthRem={annotationSidebarWidthRem}
              db={annotationsIDB}
              {context}
              {annotationValue}
              onSelectAnnotation={selectAnnotation}
              onSelectAnnotationGroup={selectAnnotationGroup}
              onDeleteAnnotation={deleteAnnotation}
              onEditability={setEditability}
              onVisibility={setVisibility}
            />
          </ResizablePane>

          <ResizableHandle withHandle />

          <!-- IMAGE EDITOR -->
          <ResizablePane defaultSize={60}>
            <section id="image-section" class="flex h-full w-full">
              <ImageOverlay
                bind:this={overlay}
                {annotations_promise}
                onSelectAnnotation={selectAnnotation}
                onSelection={onShapeSelection}
                onAddNewNote={showNewNotePopup}
                target_container={() => player_container}
                src={context.mediaUrl}
              ></ImageOverlay>
            </section>
          </ResizablePane>

          <ResizableHandle withHandle />

          <!-- RIGHT SIDEBAR -->
          <ResizablePane minSize={16} defaultSize={16} maxSize={20}>
            <ImagePropertiesSidebar
              {annotationId}
              {annotationValue}
              {onEditValue}
              onReSelectCategory={reSelectCategory}
              {context}
            />
          </ResizablePane>
        </ResizablePaneGroup>
      </ResizablePane>

      <!-- BOTTOM PANEL -->
      <ResizableHandle withHandle />
    </ResizablePaneGroup>
  </div>
</div>
