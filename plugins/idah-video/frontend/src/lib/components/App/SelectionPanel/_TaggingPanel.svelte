<script lang="ts">
  import Text from "$lib/components/ui/Text/Text.svelte";
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
  import { Separator } from "$lib/components/ui/Separator";
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import CategorySelect from "$lib/components/App/SelectionPanel/_CategorySelect.svelte";
  import PropertiesSection from "$lib/components/App/SelectionPanel/_PropertiesSection.svelte";
  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";

  import { getDriver } from "$lib/state/driver.svelte";
  import { annotation } from "$lib/state/annotation.svelte";
  import { selection } from "$lib/state/selection.svelte";

  import { VIDEO_FRAME, ENTRY_ROOT, type IVideoAnnotationRecord, type IVideoAnnotationValue } from "$lib/types";

  type Props = {
    /** Which sub-form to render (driven by the Tagging sub-tabs). */
    activeTab: "entry" | "frame";
    entryRootAnnotation: IVideoAnnotationRecord | undefined;
    /** All idah-video:frame annotations for the CURRENT frame (one per category). */
    currentFrameAnnotations?: IVideoAnnotationRecord[];
    currentFrame: number;
    /** Returns whether the change was persisted (false when a required field is missing). */
    onEntryRootChange?: (value: IVideoAnnotationValue) => boolean;
    onFrameCreate?: (value: IVideoAnnotationValue) => boolean;
    onFrameUpdate?: (ann: IVideoAnnotationRecord, value: IVideoAnnotationValue) => boolean;
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

  // Visible feedback when a change can't be saved because a required field is
  // missing. The draft still shows the user's edit, but the record is unchanged.
  let saveError = $state<string | null>(null);

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
  const frameProperties = $derived(frameConfig?.properties ?? []);

  // Categories already used by existing frame annotations at the current frame.

  // Used to disable them in the create picker — only one frame annotation per category.

  const usedFrameCategories = $derived(
    new Set(currentFrameAnnotations.map((a) => a.value?.category).filter((c): c is string => Boolean(c))),
  );

  // Categories still available to create a new frame annotation at the current frame.
  const availableFrameCategories = $derived(frameValues.filter((v) => !usedFrameCategories.has(v.id)));

  // The workspace owns the required-field gate (single place per shape type); here
  // we only surface feedback when a change was dropped because it was incomplete.
  function onRootChange(next: IVideoAnnotationValue) {
    rootDraft = next;
    saveError = null;
    if (onEntryRootChange?.(next) === false) {
      saveError = "Complete the required fields to save the video tagging.";
    }
  }

  function handleFrameCreate(next: IVideoAnnotationValue) {
    frameCreateDraft = next;
    saveError = null;
    const ok = onFrameCreate?.(next);
    if (ok === false) {
      saveError = "Complete the required fields to save the frame tagging.";
    } else {
      // Successful create (or no handler): return to the frame list view.
      frameCreateDraft = {};
    }
  }

  function handleFrameEdit(next: IVideoAnnotationValue) {
    frameEditDraft = next;
    saveError = null;
    if (selectedFrameAnnotation && onFrameUpdate?.(selectedFrameAnnotation, next) === false) {
      saveError = "Complete the required fields to save the frame tagging.";
    }
  }
</script>

{#if !rootConfig && !frameConfig}
  <Text size="sm" class="text-muted-foreground">
    No entry-level or frame-level tagging is configured for this dataset.
  </Text>
{:else if activeTab === "entry"}
  {#if rootConfig}
    <section class="flex flex-col gap-3">
      {#if saveError}
        <p class="bg-destructive/10 text-destructive rounded-md px-2 py-1 text-xs">{saveError}</p>
      {/if}
      <div class="flex items-center gap-2">
        <Text weight="semibold">Video</Text>
        <Badge variant={entryRootAnnotation ? "info" : "success-200"}>{entryRootAnnotation ? "EDIT" : "CREATE"}</Badge>
        {#if entryRootAnnotation}
          <div class="ml-auto flex items-center gap-0">
            <CategoryAction
              label={annotation.isHidden(entryRootAnnotation) ? "Show video tag" : "Hide video tag"}
              icon={annotation.isHidden(entryRootAnnotation) ? EyeOffIcon : EyeIcon}
              onclick={() => annotation.toggleHidden(entryRootAnnotation.id, !annotation.isHidden(entryRootAnnotation))}
            />
            <CategoryAction
              label={annotation.isLocked(entryRootAnnotation) ? "Unlock video tag" : "Lock video tag"}
              icon={annotation.isLocked(entryRootAnnotation) ? LockIcon : LockOpenIcon}
              onclick={() => annotation.toggleLocked(entryRootAnnotation.id, !annotation.isLocked(entryRootAnnotation))}
            />
            <CategoryAction label="Delete video tag" icon={Trash2Icon} {disabled} onclick={() => onEntryRootDelete?.()} />
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
{:else if frameConfig}
  {#key currentFrame}
    <section class="flex flex-col gap-3">
      {#if saveError}
        <p class="bg-destructive/10 text-destructive rounded-md px-2 py-1 text-xs">{saveError}</p>
      {/if}
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
                label={annotation.isHidden(selectedFrameAnnotation) ? "Show frame tag" : "Hide frame tag"}
                icon={annotation.isHidden(selectedFrameAnnotation) ? EyeOffIcon : EyeIcon}
                onclick={() =>
                  annotation.toggleHidden(selectedFrameAnnotation.id, !annotation.isHidden(selectedFrameAnnotation))}
              />
              <CategoryAction
                label={annotation.isLocked(selectedFrameAnnotation) ? "Unlock frame tag" : "Lock frame tag"}
                icon={annotation.isLocked(selectedFrameAnnotation) ? LockIcon : LockOpenIcon}
                onclick={() =>
                  annotation.toggleLocked(selectedFrameAnnotation.id, !annotation.isLocked(selectedFrameAnnotation))}
              />
              <CategoryAction
                label="Delete frame tag"
                icon={Trash2Icon}
                {disabled}
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
                  <span class="text-muted-foreground truncate">{ann.value?.category ?? "Uncategorized"}</span>
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
