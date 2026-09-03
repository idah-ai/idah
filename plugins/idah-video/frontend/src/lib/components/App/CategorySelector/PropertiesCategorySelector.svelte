<script lang="ts">
  import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent } from "$lib/components/ui/Sidebar";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/Tabs";
  import Tooltips from "$lib/components/ui/Tooltips/Tooltips.svelte";
  import Kbd from "$lib/components/ui/Kbd/Kbd.svelte";
  import KbdGroup from "$lib/components/ui/Kbd/KbdGroup.svelte";
  import { getShortcutLabel } from "$lib/components/ui/Kbd/utils";

  import SelectionPanel from "$lib/components/App/SelectionPanel/SelectionPanel.svelte";
  import TaggingPanel from "$lib/components/App/SelectionPanel/_TaggingPanel.svelte";

  import { entryRoot } from "$lib/state/entry-root.svelte";
  import { sidebarTabs } from "$lib/state/sidebar-tabs.svelte";
  import { selection, type IAnnotationGroupSelection, type IAnnotationSelection } from "$lib/state/selection.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { annotation } from "$lib/state/annotation.svelte";

  import type { IConfigValue } from "$idah/v2/types";
  import {
    ENTRY_ROOT,
    NON_DRAWABLE_SHAPE_TYPES,
    VIDEO_FRAME,
    type IVideoAnnotationRecord,
    type IVideoAnnotationValue,
  } from "$lib/types";

  // Props
  let {
    sidebarWidthRem = 20,
    annotationId,
    annotationValue,
    onEditValue,
    onReSelectCategory,
    entryRootAnnotation,
    currentFrameAnnotations,
    currentFrame,
    onEntryRootChange,
    onFrameCreate,
    onFrameUpdate,
    onDeleteEntryRoot,
    onDeleteFrame,
  }: {
    sidebarWidthRem?: number;
    annotationId?: string;
    annotationValue: IVideoAnnotationValue;
    onEditValue: (annotationValue: IVideoAnnotationValue, mode: string) => void;
    onReSelectCategory?: (reselectedCategoryId: string) => void;
    entryRootAnnotation?: IVideoAnnotationRecord;
    currentFrameAnnotations?: IVideoAnnotationRecord[];
    currentFrame?: number;
    onEntryRootChange?: (value: IVideoAnnotationValue) => boolean;
    onFrameCreate?: (value: IVideoAnnotationValue) => boolean;
    onFrameUpdate?: (ann: IVideoAnnotationRecord, value: IVideoAnnotationValue) => boolean;
    onDeleteEntryRoot?: () => void;
    onDeleteFrame?: (ann: IVideoAnnotationRecord) => void;
  } = $props();

  // Variables
  let tools = $derived(
    new Map<string, IConfigValue[]>(
      Object.entries(getDriver().config)
        .filter(([shapeType]) => !NON_DRAWABLE_SHAPE_TYPES.has(shapeType))
        .map(([shapeType, { values }]) => [shapeType, values]),
    ),
  );
  let mode = $derived(viewport.mode);
  let selAnnotation = $derived(
    selection.isAnnotation() ? (selection.value as IAnnotationSelection).annotation : undefined,
  );
  let selGroupId = $derived(selection.isGroup() ? (selection.value as IAnnotationGroupSelection).groupId : undefined);
  let defaultMode = $derived(mode == "editor" || !tools.has(mode));

  // Derived disabled state using the annotation module
  let disabled = $derived(
    (selAnnotation && annotation.isLocked(selAnnotation)) ||
      (selGroupId && annotation.isLocked(selGroupId)) ||
      (defaultMode || mode == ENTRY_ROOT ? !!entryRoot?.value?.locked : false) ||
      !["annotate", "review"].includes(getDriver().workflowStep),
  );

  // Tagging tab disabled state: follows the same editability rules as the
  // Annotations tab (workflow step + lock state of the existing records).
  let taggingDisabled = $derived(
    (entryRootAnnotation && annotation.isLocked(entryRootAnnotation)) ||
      (currentFrameAnnotations?.some((a) => annotation.isLocked(a)) ?? false) ||
      !["annotate", "review"].includes(getDriver().workflowStep),
  );

  // Whether each tagging sub-form is configured for this dataset.
  let hasEntryConfig = $derived(Boolean(getDriver().config[ENTRY_ROOT]));
  let hasFrameConfig = $derived(Boolean(getDriver().config[VIDEO_FRAME]));
  // Hide the whole tab bar when no tagging config exists.
  let showTabs = $derived(hasEntryConfig || hasFrameConfig);

  // Outer tab: "annotations" | "tagging"
  let activeRightTab = $derived(sidebarTabs.rightTab);
  // Inner tagging sub-tab: "entry" | "frame"
  let activeTaggingTab = $derived(sidebarTabs.taggingTab);

  // When only one tagging sub-form is configured, show it directly without
  // sub-tabs. Otherwise default to "entry".
  let showTaggingSubTabs = $derived(hasEntryConfig && hasFrameConfig);
  let effectiveTaggingTab = $derived(showTaggingSubTabs ? activeTaggingTab : hasFrameConfig ? "frame" : "entry");

  // ── Selection-driven tab switching ─────────────────────────────────────
  // Selecting an annotation routes to the appropriate tab:
  //   - idah-video:frame → tagging > frame
  //   - any shaped (drawable) annotation → annotations
  //   - entry:root → tagging > entry
  $effect(() => {
    const sel = selection.value;
    if (!sel) return;
    if (sel.type === "annotation") {
      const shapeType = (sel.annotation.shape as { type?: string })?.type;
      if (shapeType === VIDEO_FRAME) {
        sidebarTabs.rightTab = "tagging";
        sidebarTabs.taggingTab = "frame";
      } else if (shapeType === ENTRY_ROOT) {
        sidebarTabs.rightTab = "tagging";
        sidebarTabs.taggingTab = "entry";
      } else {
        sidebarTabs.rightTab = "annotations";
      }
    }
  });

  // Selecting a drawable tool (bounding-box / polygon) switches to the
  // Annotations tab so the create form is visible, as it was before the tabs.
  $effect(() => {
    if (viewport.isCreationMode) sidebarTabs.rightTab = "annotations";
  });

  // ── Entry-root tab: keep the entry:root annotation as the active selection ──
  // When the user is on the Tagging > Video (entry) tab and an entry:root record
  // exists, it must be the active global selection so the generic per-selection
  // commands (delete, hide, lock, …) work on it. Guard against re-triggering the
  // inverse effect above (which switches to this tab when entry:root is selected).
  $effect(() => {
    if (sidebarTabs.rightTab !== "tagging" || sidebarTabs.taggingTab !== "entry") return;
    if (!entryRootAnnotation) return;
    if (selection.isAnnotationSelected(entryRootAnnotation.id)) return;
    selection.selectAnnotation(entryRootAnnotation as any);
  });

  // When the entry:root annotation is deselected while still on the entry tab,
  // switch back to the Annotations tab so the Tagging tab never shows an
  // empty/awkward state. This only fires on the transition from "entry:root was
  // selected" to "nothing is selected" — if no entry:root exists yet, the user is
  // legitimately on a create form and must not be bounced back. The Frame
  // sub-tab keeps its own deselect behavior (return to its list).
  $effect(() => {
    if (sidebarTabs.rightTab !== "tagging" || sidebarTabs.taggingTab !== "entry") return;
    if (!entryRootAnnotation) return;
    if (selection.isAnnotationSelected(entryRootAnnotation.id)) return;
    sidebarTabs.rightTab = "annotations";
  });



  // Functions
  function categorySelection(shape_type: string, categoryId?: string) {
    if (categoryId) onEditValue({ category: categoryId }, shape_type);
  }

  /** Clicking a tab deselects synchronously and switches the tab directly, so
   *  the target tab never renders with a stale selection. (The shortcut commands
   *  do the same inside their do(), which runs synchronously for these no-undo
   *  navigation commands.) */
  function handleOuterTabClick(tab: "annotations" | "tagging") {
    selection.deselect();
    sidebarTabs.rightTab = tab;
  }

  function handleTaggingTabClick(tab: "entry" | "frame") {
    selection.deselect();
    sidebarTabs.rightTab = "tagging";
    sidebarTabs.taggingTab = tab;
  }

  function shortcutLabel(commandName: string): string | undefined {
    const raw = getDriver().command.getShortcut(commandName);
    return raw ? getShortcutLabel(raw) : undefined;
  }

  // bits-ui's Tabs uses roving-tabindex arrow-key navigation on the TabsList,
  // which would steal the arrow keys from the video player's frame stepping.
  // Stop arrow/Home/End keys from being consumed here so they reach the
  // workspace's window-level keydown handler instead.
  function handleTabsListKeydown(e: KeyboardEvent) {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
      e.stopPropagation();
    }
  }
</script>

<Sidebar variant="inset" collapsible="none" style="width: {sidebarWidthRem}rem;" side="right">
  <SidebarContent>
    <SidebarGroup class="p-3">
      <SidebarGroupContent>
        {#if showTabs}
          <Tabs bind:value={activeRightTab}>
            <TabsList class="w-full" onkeydown={handleTabsListKeydown}>
              <Tooltips class="flex-1 flex">
                {#snippet trigger()}
                  <TabsTrigger value="annotations" class="w-full text-xs" onclick={() => handleOuterTabClick("annotations")}>
                    Annotations
                  </TabsTrigger>
                {/snippet}
                {#snippet content()}
                  <div class="flex items-center gap-4">
                    <span>Annotations</span>
                    {#if shortcutLabel("idah-video:sidebar-tab.selection")}
                      <KbdGroup>
                        <Kbd class="border">{shortcutLabel("idah-video:sidebar-tab.selection")}</Kbd>
                      </KbdGroup>
                    {/if}
                  </div>
                {/snippet}
              </Tooltips>
              <Tooltips class="flex-1 flex">
                {#snippet trigger()}
                  <TabsTrigger value="tagging" class="w-full text-xs" onclick={() => handleOuterTabClick("tagging")}>
                    Tagging
                  </TabsTrigger>
                {/snippet}
                {#snippet content()}
                  <div class="flex items-center gap-4">
                    <span>Tagging</span>
                    {#if shortcutLabel("idah-video:sidebar-tab.tagging")}
                      <KbdGroup>
                        <Kbd class="border">{shortcutLabel("idah-video:sidebar-tab.tagging")}</Kbd>
                      </KbdGroup>
                    {/if}
                  </div>
                {/snippet}
              </Tooltips>
            </TabsList>

            <TabsContent value="annotations">
              {#key [annotationValue, mode, entryRoot?.value?.category]}
                <SelectionPanel
                  selectedCategory={(defaultMode
                    ? annotationValue.category || entryRoot?.value?.category
                    : annotationValue.category) || ""}
                  {annotationId}
                  annotationValue={(defaultMode
                    ? Object.keys(annotationValue).length
                      ? annotationValue
                      : entryRoot?.value
                    : annotationValue) || {}}
                  onSelectCategory={(selectedCategoryId) =>
                    categorySelection(defaultMode ? ENTRY_ROOT : mode, selectedCategoryId)}
                  onReSelectCategory={(reselectedCategoryId) => onReSelectCategory?.(reselectedCategoryId)}
                  onEditValue={(value) => value && onEditValue(value, defaultMode ? ENTRY_ROOT : mode)}
                  {disabled}
                />
              {/key}
            </TabsContent>

            <TabsContent value="tagging">
              {#if showTaggingSubTabs}
                <Tabs bind:value={activeTaggingTab}>
                  <TabsList class="w-full" onkeydown={handleTabsListKeydown}>
                    <Tooltips class="flex-1 flex">
                      {#snippet trigger()}
                        <TabsTrigger value="entry" class="w-full text-xs" onclick={() => handleTaggingTabClick("entry")}>
                          Video
                        </TabsTrigger>
                      {/snippet}
                      {#snippet content()}
                        <div class="flex items-center gap-4">
                          <span>Video</span>
                          {#if shortcutLabel("idah-video:sidebar-tab.video")}
                            <KbdGroup>
                              <Kbd class="border">{shortcutLabel("idah-video:sidebar-tab.video")}</Kbd>
                            </KbdGroup>
                          {/if}
                        </div>
                      {/snippet}
                    </Tooltips>
                    <Tooltips class="flex-1 flex">
                      {#snippet trigger()}
                        <TabsTrigger value="frame" class="w-full text-xs" onclick={() => handleTaggingTabClick("frame")}>
                          Frame
                        </TabsTrigger>
                      {/snippet}
                      {#snippet content()}
                        <div class="flex items-center gap-4">
                          <span>Frame</span>
                          {#if shortcutLabel("idah-video:sidebar-tab.frame")}
                            <KbdGroup>
                              <Kbd class="border">{shortcutLabel("idah-video:sidebar-tab.frame")}</Kbd>
                            </KbdGroup>
                          {/if}
                        </div>
                      {/snippet}
                    </Tooltips>
                  </TabsList>
                  <TabsContent value="entry">
                    <TaggingPanel
                      activeTab="entry"
                      {entryRootAnnotation}
                      {currentFrameAnnotations}
                      currentFrame={currentFrame ?? 0}
                      onEntryRootChange={onEntryRootChange}
                      onFrameCreate={onFrameCreate}
                      onFrameUpdate={onFrameUpdate}
                      onEntryRootDelete={onDeleteEntryRoot ?? (() => {})}
                      onFrameDelete={onDeleteFrame ?? (() => {})}
                      disabled={taggingDisabled}
                    />
                  </TabsContent>
                  <TabsContent value="frame">
                    <TaggingPanel
                      activeTab="frame"
                      {entryRootAnnotation}
                      {currentFrameAnnotations}
                      currentFrame={currentFrame ?? 0}
                      onEntryRootChange={onEntryRootChange}
                      onFrameCreate={onFrameCreate}
                      onFrameUpdate={onFrameUpdate}
                      onEntryRootDelete={onDeleteEntryRoot ?? (() => {})}
                      onFrameDelete={onDeleteFrame ?? (() => {})}
                      disabled={taggingDisabled}
                    />
                  </TabsContent>
                </Tabs>
              {:else}
                <TaggingPanel
                  activeTab={effectiveTaggingTab}
                  {entryRootAnnotation}
                  {currentFrameAnnotations}
                  currentFrame={currentFrame ?? 0}
                  onEntryRootChange={onEntryRootChange}
                  onFrameCreate={onFrameCreate}
                  onFrameUpdate={onFrameUpdate}
                  onEntryRootDelete={onDeleteEntryRoot ?? (() => {})}
                  onFrameDelete={onDeleteFrame ?? (() => {})}
                  disabled={taggingDisabled}
                />
              {/if}
            </TabsContent>
          </Tabs>
        {:else}
          {#key [annotationValue, mode, entryRoot?.value?.category]}
            <SelectionPanel
              selectedCategory={(defaultMode
                ? annotationValue.category || entryRoot?.value?.category
                : annotationValue.category) || ""}
              {annotationId}
              annotationValue={(defaultMode
                ? Object.keys(annotationValue).length
                  ? annotationValue
                  : entryRoot?.value
                : annotationValue) || {}}
              onSelectCategory={(selectedCategoryId) =>
                categorySelection(defaultMode ? ENTRY_ROOT : mode, selectedCategoryId)}
              onReSelectCategory={(reselectedCategoryId) => onReSelectCategory?.(reselectedCategoryId)}
              onEditValue={(value) => value && onEditValue(value, defaultMode ? ENTRY_ROOT : mode)}
              {disabled}
            />
          {/key}
        {/if}
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>