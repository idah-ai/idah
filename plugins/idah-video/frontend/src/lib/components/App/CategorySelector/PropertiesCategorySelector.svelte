<script lang="ts">
  import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent } from "$lib/components/ui/Sidebar";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/Tabs";
  import Tooltips from "$lib/components/ui/Tooltips/Tooltips.svelte";
  import Kbd from "$lib/components/ui/Kbd/Kbd.svelte";
  import KbdGroup from "$lib/components/ui/Kbd/KbdGroup.svelte";
  import { getShortcutLabel } from "$lib/components/ui/Kbd/utils";

  import SelectionPanel from "$lib/components/App/SelectionPanel/SelectionPanel.svelte";
  import MetaPanel from "$lib/components/App/SelectionPanel/_MetaPanel.svelte";

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
    frameAnnotation,
    currentFrame,
    onEntryRootChange,
    onFrameChange,
    onDeleteEntryRoot,
    onDeleteFrame,
  }: {
    sidebarWidthRem?: number;
    annotationId?: string;
    annotationValue: IVideoAnnotationValue;
    onEditValue: (annotationValue: IVideoAnnotationValue, mode: string) => void;
    onReSelectCategory?: (reselectedCategoryId: string) => void;
    entryRootAnnotation?: IVideoAnnotationRecord;
    frameAnnotation?: IVideoAnnotationRecord;
    currentFrame?: number;
    onEntryRootChange?: (value: IVideoAnnotationValue) => void;
    onFrameChange?: (value: IVideoAnnotationValue) => void;
    onDeleteEntryRoot?: () => void;
    onDeleteFrame?: () => void;
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

  // Meta tab disabled state: follows the same editability rules as the
  // Annotations tab (workflow step + lock state of the existing records).
  let metaDisabled = $derived(
    (entryRootAnnotation && annotation.isLocked(entryRootAnnotation)) ||
      (frameAnnotation && annotation.isLocked(frameAnnotation)) ||
      !["annotate", "review"].includes(getDriver().workflowStep),
  );

  // Whether each meta sub-form is configured for this dataset.
  let hasEntryConfig = $derived(Boolean(getDriver().config[ENTRY_ROOT]));
  let hasFrameConfig = $derived(Boolean(getDriver().config[VIDEO_FRAME]));
  // Hide the whole tab bar when no meta config exists.
  let showTabs = $derived(hasEntryConfig || hasFrameConfig);

  // Outer tab: "annotations" | "meta"
  let activeRightTab = $derived(sidebarTabs.rightTab);
  // Inner meta sub-tab: "entry" | "frame"
  let activeMetaTab = $derived(sidebarTabs.metaTab);

  // When only one meta sub-form is configured, show it directly without
  // sub-tabs. Otherwise default to "entry".
  let showMetaSubTabs = $derived(hasEntryConfig && hasFrameConfig);
  let effectiveMetaTab = $derived(showMetaSubTabs ? activeMetaTab : hasFrameConfig ? "frame" : "entry");

  // ── Selection-driven tab switching ─────────────────────────────────────
  // Selecting an annotation routes to the appropriate tab:
  //   - idah-video:frame → meta > frame
  //   - any shaped (drawable) annotation → annotations
  //   - entry:root → meta > entry
  $effect(() => {
    const sel = selection.value;
    if (!sel) return;
    if (sel.type === "annotation") {
      const shapeType = (sel.annotation.shape as { type?: string })?.type;
      if (shapeType === VIDEO_FRAME) {
        sidebarTabs.rightTab = "meta";
        sidebarTabs.metaTab = "frame";
      } else if (shapeType === ENTRY_ROOT) {
        sidebarTabs.rightTab = "meta";
        sidebarTabs.metaTab = "entry";
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

  // Functions
  function categorySelection(shape_type: string, categoryId?: string) {
    if (categoryId) onEditValue({ category: categoryId }, shape_type);
  }

  /** Clicking a tab routes through the same command as the shortcut, so the
   *  deselection behavior is identical whether the user clicks or presses a key. */
  function handleOuterTabClick(tab: "annotations" | "meta") {
    if (tab === "annotations") getDriver().command.call("idah-video:sidebar-tab.selection");
    else getDriver().command.call("idah-video:sidebar-tab.meta");
  }

  function handleMetaTabClick(tab: "entry" | "frame") {
    if (tab === "entry") getDriver().command.call("idah-video:sidebar-tab.entry");
    else getDriver().command.call("idah-video:sidebar-tab.frame");
  }

  function shortcutLabel(commandName: string): string | undefined {
    const raw = getDriver().command.getShortcut(commandName);
    return raw ? getShortcutLabel(raw) : undefined;
  }
</script>

<Sidebar variant="inset" collapsible="none" style="width: {sidebarWidthRem}rem;" side="right">
  <SidebarContent>
    <SidebarGroup class="p-3">
      <SidebarGroupContent>
        {#if showTabs}
          <Tabs bind:value={activeRightTab}>
            <TabsList class="w-full">
              <Tooltips class="contents">
                {#snippet trigger()}
                  <TabsTrigger value="annotations" class="text-xs" onclick={() => handleOuterTabClick("annotations")}>
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
              <Tooltips class="contents">
                {#snippet trigger()}
                  <TabsTrigger value="meta" class="text-xs" onclick={() => handleOuterTabClick("meta")}>
                    Meta
                  </TabsTrigger>
                {/snippet}
                {#snippet content()}
                  <div class="flex items-center gap-4">
                    <span>Meta</span>
                    {#if shortcutLabel("idah-video:sidebar-tab.meta")}
                      <KbdGroup>
                        <Kbd class="border">{shortcutLabel("idah-video:sidebar-tab.meta")}</Kbd>
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

            <TabsContent value="meta">
              {#if showMetaSubTabs}
                <Tabs bind:value={activeMetaTab}>
                  <TabsList class="w-full">
                    <Tooltips class="contents">
                      {#snippet trigger()}
                        <TabsTrigger value="entry" class="text-xs" onclick={() => handleMetaTabClick("entry")}>
                          Entry
                        </TabsTrigger>
                      {/snippet}
                      {#snippet content()}
                        <div class="flex items-center gap-4">
                          <span>Entry</span>
                          {#if shortcutLabel("idah-video:sidebar-tab.entry")}
                            <KbdGroup>
                              <Kbd class="border">{shortcutLabel("idah-video:sidebar-tab.entry")}</Kbd>
                            </KbdGroup>
                          {/if}
                        </div>
                      {/snippet}
                    </Tooltips>
                    <Tooltips class="contents">
                      {#snippet trigger()}
                        <TabsTrigger value="frame" class="text-xs" onclick={() => handleMetaTabClick("frame")}>
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
                    <MetaPanel
                      activeTab="entry"
                      {entryRootAnnotation}
                      {frameAnnotation}
                      currentFrame={currentFrame ?? 0}
                      onEntryRootChange={onEntryRootChange}
                      onFrameChange={onFrameChange}
                      onEntryRootDelete={onDeleteEntryRoot ?? (() => {})}
                      onFrameDelete={onDeleteFrame ?? (() => {})}
                      disabled={metaDisabled}
                    />
                  </TabsContent>
                  <TabsContent value="frame">
                    <MetaPanel
                      activeTab="frame"
                      {entryRootAnnotation}
                      {frameAnnotation}
                      currentFrame={currentFrame ?? 0}
                      onEntryRootChange={onEntryRootChange}
                      onFrameChange={onFrameChange}
                      onEntryRootDelete={onDeleteEntryRoot ?? (() => {})}
                      onFrameDelete={onDeleteFrame ?? (() => {})}
                      disabled={metaDisabled}
                    />
                  </TabsContent>
                </Tabs>
              {:else}
                <MetaPanel
                  activeTab={effectiveMetaTab}
                  {entryRootAnnotation}
                  {frameAnnotation}
                  currentFrame={currentFrame ?? 0}
                  onEntryRootChange={onEntryRootChange}
                  onFrameChange={onFrameChange}
                  onEntryRootDelete={onDeleteEntryRoot ?? (() => {})}
                  onFrameDelete={onDeleteFrame ?? (() => {})}
                  disabled={metaDisabled}
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