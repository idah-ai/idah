<script lang="ts">
  import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent } from "$lib/components/ui/Sidebar";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/Tabs";
  import Tooltips from "$lib/components/ui/Tooltips/Tooltips.svelte";
  import Kbd from "$lib/components/ui/Kbd/Kbd.svelte";
  import KbdGroup from "$lib/components/ui/Kbd/KbdGroup.svelte";
  import { getShortcutLabel } from "$lib/components/ui/Kbd/utils";

  import SelectionPanel from "$lib/components/App/SelectionPanel/SelectionPanel.svelte";
  import MetaPanel from "$lib/components/App/SelectionPanel/_MetaPanel.svelte";

  import { annotation } from "$lib/state/annotation.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { entryRoot } from "$lib/state/entry-root.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { sidebarTabs } from "$lib/state/sidebar-tabs.svelte";
  import { viewport } from "$lib/state/viewport.svelte";

  import type { IConfigValue } from "$idah/v2/types";
  import {
    DEFAULT_MODE,
    ENTRY_ROOT,
    NON_DRAWABLE_SHAPE_TYPES,
    type IImageAnnotationRecord,
    type IImageAnnotationValue,
  } from "$lib/types";

  // Props
  let {
    sidebarWidthRem = 20,
    annotationId,
    annotationValue,
    onEditValue,
    onReSelectCategory,
    entryRootAnnotation,
    onEntryRootChange,
    onDeleteEntryRoot,
  }: {
    sidebarWidthRem?: number;
    annotationId?: string;
    annotationValue: IImageAnnotationValue;
    onEditValue: (annotationValue: IImageAnnotationValue, mode: string) => void;
    onReSelectCategory?: (reselectedCategoryId: string) => void;
    entryRootAnnotation?: IImageAnnotationRecord;
    onEntryRootChange?: (value: IImageAnnotationValue) => void;
    onDeleteEntryRoot?: () => void;
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
  let selAnnotation = $derived(selection.value);
  let defaultMode = $derived(mode == DEFAULT_MODE || !tools.has(mode));

  // Derived disabled state using the annotation module
  let disabled = $derived(
    (selAnnotation && annotation.isLocked(selAnnotation)) ||
      (defaultMode || mode == ENTRY_ROOT ? !!entryRoot?.value?.locked : false) ||
      !["annotate", "review"].includes(getDriver().workflowStep),
  );

  // Meta tab disabled state: follows the same editability rules as the
  // Annotations tab (workflow step + lock state of the existing entry:root record).
  let metaDisabled = $derived(
    (entryRootAnnotation && annotation.isLocked(entryRootAnnotation)) ||
      !["annotate", "review"].includes(getDriver().workflowStep),
  );

  let activeRightTab = $derived(sidebarTabs.rightTab);

  // Hide the whole tab bar when no tag config exists (image only has entry:root).
  let showTabs = $derived(Boolean(getDriver().config[ENTRY_ROOT]));

  // ── Selection-driven tab switching ─────────────────────────────────────
  // Selecting an annotation routes to the appropriate tab:
  //   - entry:root → meta
  //   - any shaped (drawable) annotation → annotations
  $effect(() => {
    const sel = selection.value;
    if (!sel) return;
    const shapeType = (sel.shape as { type?: string })?.type;
    if (shapeType === ENTRY_ROOT) {
      sidebarTabs.rightTab = "meta";
    } else {
      sidebarTabs.rightTab = "annotations";
    }
  });

  // Selecting a drawable tool (bounding-box / polygon / etc.) switches to the
  // Annotations tab so the create form is visible, as it was before the tabs.
  $effect(() => {
    if (viewport.isCreationMode) sidebarTabs.rightTab = "annotations";
  });

  // Functions
  function categorySelection(shape_type: string, categoryId?: string) {
    if (categoryId) onEditValue({ category: categoryId }, shape_type);
  }

  /** Clicking a tab deselects synchronously and switches the tab directly, so
   *  the target tab never renders with a stale selection. (The shortcut commands
   *  do the same inside their do(), which runs synchronously for these no-undo
   *  navigation commands.) */
  function handleOuterTabClick(tab: "annotations" | "meta") {
    selection.deselect();
    sidebarTabs.rightTab = tab;
  }

  function shortcutLabel(commandName: string): string | undefined {
    const raw = getDriver().command.getShortcut(commandName);
    return raw ? getShortcutLabel(raw) : undefined;
  }

  // bits-ui's Tabs uses roving-tabindex arrow-key navigation on the TabsList,
  // which would steal the arrow keys from the image workspace's key handling.
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
                    {#if shortcutLabel("idah-image:sidebar-tab.selection")}
                      <KbdGroup>
                        <Kbd class="border">{shortcutLabel("idah-image:sidebar-tab.selection")}</Kbd>
                      </KbdGroup>
                    {/if}
                  </div>
                {/snippet}
              </Tooltips>
              <Tooltips class="flex-1 flex">
                {#snippet trigger()}
                  <TabsTrigger value="meta" class="w-full text-xs" onclick={() => handleOuterTabClick("meta")}>
                    Meta
                  </TabsTrigger>
                {/snippet}
                {#snippet content()}
                  <div class="flex items-center gap-4">
                    <span>Meta</span>
                    {#if shortcutLabel("idah-image:sidebar-tab.meta")}
                      <KbdGroup>
                        <Kbd class="border">{shortcutLabel("idah-image:sidebar-tab.meta")}</Kbd>
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
              <MetaPanel
                entryRootAnnotation={entryRootAnnotation}
                onCreateOrUpdate={onEntryRootChange}
                onDelete={onDeleteEntryRoot ?? (() => {})}
                disabled={metaDisabled}
              />
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
