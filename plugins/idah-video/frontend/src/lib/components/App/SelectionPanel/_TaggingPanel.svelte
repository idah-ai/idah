<script lang="ts">
  import Text from "$lib/components/ui/Text/Text.svelte";
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
  import { Separator } from "$lib/components/ui/Separator";
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import CategorySelect from "$lib/components/App/SelectionPanel/_CategorySelect.svelte";
  import PropertiesSection from "$lib/components/App/SelectionPanel/_PropertiesSection.svelte";
  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";
  import { requiredFullfilled } from "$lib/components/App/SelectionPanel";
  import Button from "$lib/components/ui/Button/Button.svelte";

  import { getDriver } from "$lib/state/driver.svelte";
  import { annotation } from "$lib/state/annotation.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { sidebarTabs } from "$lib/state/sidebar-tabs.svelte";

  import {
    VIDEO_FRAME,
    ENTRY_ROOT,
    type IVideoAnnotationRecord,
    type IVideoAnnotationValue,
  } from "$lib/types";

  type Props = {
    /** Which sub-form to render (driven by the Tagging sub-tabs). */
    activeTab:"entry" | "frame";
    entryRootAnnotation: IVideoAnnotationRecord | undefined;
    /** All idah-video:frame annotations for the CURRENT frame (one per category). */
    currentFrameAnnotations?: IVideoAnnotationRecord[];
    currentFrame: number;
    onEntryRootChange?: (value: IVideoAnnotationValue) => void;
    onFrameCreate?: (value: IVideoAnnotationValue) => void;
    onFrameUpdate?: (ann: IVideoAnnotationRecord, value: IVideoAnnotationValue) => void;
    onEntryRootDelete?: () => void;
    onFrameDelete?: (ann: IVideoAnnotationRecord) => void;
    disabled: boolean;
  };

  let {
    activeTab,
    entryRootAnnotation,
    currentFrameAnnotations = [],
    currentFrame,
    onEntryRootChange,
    onFrameCreate,
    onFrameUpdate,
    onEntryRootDelete,
    onFrameDelete,
    disabled,
  }: Props = $props();

  // Local draft values so each sub-form is controlled even before an
  // annotation exists. Synced from the existing annotations so edits to an
  // existing record are reflected here.
  let rootDraft = $state<IVideoAnnotationValue>({});
  let frameCreateDraft = $state<IVideoAnnotationValue>({});
  let frameEditDraft = $state<IVideoAnnotationValue>({});

  // Reset the in-progress create draft when the current frame changes, so the
  // category select isn't locked to a previous frame's selection.
  let prevFrame = $state(currentFrame);
  $effect(() => {
    if (currentFrame !== prevFrame) {
      prevFrame = currentFrame;
      frameCreateDraft = {};
    }
  });

  // The currently selected frame annotation, derived from the global selection store
  // so the timeline markers and this form share the same selection state.

  let selectedFrameAnnotation = $derived.by<IVideoAnnotationRecord | undefined>(() => {
    const v = selection.value;
    if (v?.type !== "annotation") return undefined;
    const ann = v.annotation as IVideoAnnotationRecord;
    return currentFrameAnnotations.find((a) => a.id === ann.id);
  });

  $effect(() => {
    const rv = entryRootAnnotation?.value;
    rootDraft = rv ? { ...rv } : {};
  });

  // Sync the edit draft from the selected annotation.

  $effect(() => {
    const v = selectedFrameAnnotation?.value;
    frameEditDraft = v ? { ...v } : {};
  });

  const rootConfig = $derived(
    getDriver().getFilteredConfig(ENTRY_ROOT, rootDraft as unknown as Record<string, unknown>),
  );
  const frameConfig = $derived(
    getDriver().getFilteredConfig(VIDEO_FRAME, frameCreateDraft as unknown as Record<string, unknown>),
  );

  const rootValues = $derived(rootConfig?.values ?? []);
  const rootCategory = $derived(rootValues.find((c) => c.id === rootDraft.category));
  const rootProperties = $derived(rootConfig?.properties ?? []);

  const frameValues = $derived(frameConfig?.values ?? []);
  const frameCreateCategory = $derived(frameValues.find((c) => c.id === frameCreateDraft.category));
  const frameProperties = $derived(frameConfig?.properties ?? []);

  // Categories already used by existing frame annotations at the current frame.

  // Used to disable them in the create picker — only one frame annotation per category.

  const usedFrameCategories = $derived(
    new Set(currentFrameAnnotations.map((a) => a.value?.category).filter((c): c is string => Boolean(c))),
  );

  // Categories still available to create a new frame annotation at the current frame.
  const availableFrameCategories = $derived(frameValues.filter((v) => !usedFrameCategories.has(v.id)));

  function onRootChange(next: IVideoAnnotationValue) {
    rootDraft = next;
    onEntryRootChange?.(next);
  }

  function handleFrameCreate(next: IVideoAnnotationValue) {
    frameCreateDraft = next;
    // Only create/update when the category + required properties are valid.
    const properties =
      getDriver().getFilteredConfig(VIDEO_FRAME, next as unknown as Record<string, unknown>)?.properties ?? [];
    if (requiredFullfilled(next, properties)) {
      onFrameCreate?.(next);
      frameCreateDraft = {};
    }
  }

  function handleFrameEdit(next: IVideoAnnotationValue) {
    frameEditDraft = next;
    if (selectedFrameAnnotation) onFrameUpdate?.(selectedFrameAnnotation, next);
  }
</script>

{#if !rootConfig && !frameConfig}
  <Text size="sm" class="text-muted-foreground">
    No entry-level or frame-level tagging is configured for this dataset.
  </Text>
{:else if activeTab === "entry"}
  {#if rootConfig}
    <section class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <Text weight="semibold">Video</Text>
        <Badge variant={entryRootAnnotation ? "info" : "success-200"}>{entryRootAnnotation ? "EDIT" : "CREATE"}</Badge>
        {#if entryRootAnnotation}
          <div class="ml-auto flex items-center gap-0">
            <CategoryAction
              label={annotation.isHidden(entryRootAnnotation) ? "Show video" : "Hide video"}
              icon={annotation.isHidden(entryRootAnnotation) ? EyeOffIcon : EyeIcon}
              onclick={() => annotation.toggleHidden(entryRootAnnotation.id, !annotation.isHidden(entryRootAnnotation))}
            />
            <CategoryAction
              label={annotation.isLocked(entryRootAnnotation) ? "Unlock video" : "Lock video"}
              icon={annotation.isLocked(entryRootAnnotation) ? LockIcon : LockOpenIcon}
              onclick={() => annotation.toggleLocked(entryRootAnnotation.id, !annotation.isLocked(entryRootAnnotation))}
            />
            <CategoryAction
              label="Delete video"
              icon={Trash2Icon}
              disabled={disabled}
              onclick={() => onEntryRootDelete?.()}
            />
          </div>
        {/if}
      </div>

      <CategorySelect
        configValues={rootValues}
        category={rootCategory}
        selectedCategory={rootDraft.category ?? ""}
        shapeType={ENTRY_ROOT}
        onValueChange={(id) => onRootChange({ ...rootDraft, category: id })}
        {disabled}
        placeholder="Select a category"
      />

      {#if rootDraft.category && rootProperties.length > 0}
        <PropertiesSection
          properties={rootProperties}
          annotationValue={rootDraft}
          onValueChange={(property, v) =>
            onRootChange({
              ...rootDraft,
              attributes: { ...(rootDraft.attributes ?? {}), [property.id]: v },
            })}
          {disabled}
        />
      {/if}
    </section>
  {/if}
{:else}
  {#if frameConfig}
    {#key currentFrame}
      <section class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <Text weight="semibold">Frame: {currentFrame + 1}</Text>
          <button
            type="button"
            class="cursor-pointer"
            title="Back to frame annotations list"
            onclick={() => selection.deselect()}
          >
            <Badge variant="secondary">{currentFrameAnnotations.length}</Badge>
          </button>
        </div>

        {#if selectedFrameAnnotation}
          <!-- Edit form for the selected frame annotation (list hidden) -->
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <Text weight="semibold">
                {frameValues.find((v) => v.id === frameEditDraft.category)?.label ?? "Frame"}
              </Text>
              <Badge variant="info">EDIT</Badge>
              <div class="ml-auto flex items-center gap-0">
                <CategoryAction
                  label={annotation.isHidden(selectedFrameAnnotation) ? "Show frame" : "Hide frame"}
                  icon={annotation.isHidden(selectedFrameAnnotation) ? EyeOffIcon : EyeIcon}
                  onclick={() =>
                    annotation.toggleHidden(selectedFrameAnnotation.id, !annotation.isHidden(selectedFrameAnnotation))}
                />
                <CategoryAction
                  label={annotation.isLocked(selectedFrameAnnotation) ? "Unlock frame" : "Lock frame"}
                  icon={annotation.isLocked(selectedFrameAnnotation) ? LockIcon : LockOpenIcon}
                  onclick={() =>
                    annotation.toggleLocked(selectedFrameAnnotation.id, !annotation.isLocked(selectedFrameAnnotation))}
                />
                <CategoryAction
                  label="Delete frame"
                  icon={Trash2Icon}
                  disabled={disabled}
                  onclick={() => onFrameDelete?.(selectedFrameAnnotation)}
                />
              </div>
            </div>

            <CategorySelect
              configValues={frameValues}
              category={frameValues.find((v) => v.id === frameEditDraft.category)}
              selectedCategory={frameEditDraft.category ?? ""}
              shapeType={VIDEO_FRAME}
              onValueChange={(id) => handleFrameEdit({ ...frameEditDraft, category: id })}
              {disabled}
              placeholder="Select a category"
            />
            {#if frameEditDraft.category && frameProperties.length > 0}
              <PropertiesSection
                properties={frameProperties}
                annotationValue={frameEditDraft}
                onValueChange={(property, v) =>
                  handleFrameEdit({
                    ...frameEditDraft,
                    attributes: { ...(frameEditDraft.attributes ?? {}), [property.id]: v },
                  })}
                {disabled}
              />
            {/if}
          </div>
        {:else if frameCreateDraft.category}
          <!-- Create form for a new frame annotation (list hidden) -->
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <Text weight="semibold">
                {frameValues.find((v) => v.id === frameCreateDraft.category)?.label ?? "Frame"}
              </Text>
              <Badge variant="success-200">CREATE</Badge>
            </div>
            <CategorySelect
              configValues={frameValues}
              category={frameValues.find((v) => v.id === frameCreateDraft.category)}
              selectedCategory={frameCreateDraft.category ?? ""}
              shapeType={VIDEO_FRAME}
              onValueChange={(id) => handleFrameCreate({ ...frameCreateDraft, category: id })}
              disabledValues={usedFrameCategories}
              {disabled}
              placeholder="Select a category"
            />
            {#if frameCreateDraft.category && frameProperties.length > 0}
              <PropertiesSection
                properties={frameProperties}
                annotationValue={frameCreateDraft}
                onValueChange={(property, v) =>
                  handleFrameCreate({
                    ...frameCreateDraft,
                    attributes: { ...(frameCreateDraft.attributes ?? {}), [property.id]: v },
                  })}
                {disabled}
              />
            {/if}
          </div>
        {:else}
          <!-- List existing frame annotations + a category select to create a new frame -->
          <div class="flex flex-col gap-3">
            <CategorySelect
              configValues={availableFrameCategories}
              category={undefined}
              selectedCategory=""
              shapeType={VIDEO_FRAME}
              onValueChange={(id) => id && handleFrameCreate({ category: id })}
              disabled={disabled || availableFrameCategories.length === 0}
              placeholder="Select a category"
            />

            <Separator class="my-2" />

            <div class="flex flex-col gap-1">
              {#each currentFrameAnnotations as ann (ann.id)}
                {@const annCategory = frameValues.find((v) => v.id === ann.value?.category)}
                {@const annColor = annCategory?.color ?? null}
                <div
                  role="button"
                  tabindex="-1"
                  class="group hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs"
                  onclick={() => selection.selectAnnotation(ann as any)}
                  onkeypress={() => {}}
                >
                  {#if annCategory}
                    <span class="size-2 shrink-0 rounded-full" style:background-color={annColor}></span>
                    <span class="truncate">{annCategory.label}</span>
                  {:else}
                    <span class="truncate text-muted-foreground">{ann.value?.category ?? "Uncategorized"}</span>
                  {/if}
                </div>
              {:else}
                <div class="text-muted-foreground px-2 py-4 text-center text-xs">No frame annotations</div>
              {/each}
            </div>
          </div>
        {/if}
      </section>
    {/key}
  {/if}
{/if}