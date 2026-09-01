<script lang="ts">
  import Text from "$lib/components/ui/Text/Text.svelte";
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import CategorySelect from "$lib/components/App/SelectionPanel/_CategorySelect.svelte";
  import PropertiesSection from "$lib/components/App/SelectionPanel/_PropertiesSection.svelte";
  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";

  import { getDriver } from "$lib/state/driver.svelte";
  import { annotation } from "$lib/state/annotation.svelte";

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
    /** The idah-video:frame annotation for the CURRENT frame, or undefined. */
    frameAnnotation: IVideoAnnotationRecord | undefined;
    currentFrame: number;
    onEntryRootChange?: (value: IVideoAnnotationValue) => void;
    onFrameChange?: (value: IVideoAnnotationValue) => void;
    onEntryRootDelete?: () => void;
    onFrameDelete?: () => void;
    disabled: boolean;
  };

  let {
    activeTab,
    entryRootAnnotation,
    frameAnnotation,
    currentFrame,
    onEntryRootChange,
    onFrameChange,
    onEntryRootDelete,
    onFrameDelete,
    disabled,
  }: Props = $props();

  // Local draft values so each sub-form is controlled even before an
  // annotation exists. Synced from the existing annotations so edits to an
  // existing record are reflected here.
  let rootDraft = $state<IVideoAnnotationValue>({});
  let frameDraft = $state<IVideoAnnotationValue>({});
  $effect(() => {
    const rv = entryRootAnnotation?.value;
    rootDraft = rv ? { ...rv } : {};
  });
  $effect(() => {
    const fv = frameAnnotation?.value;
    frameDraft = fv ? { ...fv } : {};
  });

  const rootConfig = $derived(
    getDriver().getFilteredConfig(ENTRY_ROOT, rootDraft as unknown as Record<string, unknown>),
  );
  const frameConfig = $derived(
    getDriver().getFilteredConfig(VIDEO_FRAME, frameDraft as unknown as Record<string, unknown>),
  );

  const rootValues = $derived(rootConfig?.values ?? []);
  const rootCategory = $derived(rootValues.find((c) => c.id === rootDraft.category));
  const rootProperties = $derived(rootConfig?.properties ?? []);

  const frameValues = $derived(frameConfig?.values ?? []);
  const frameCategory = $derived(frameValues.find((c) => c.id === frameDraft.category));
  const frameProperties = $derived(frameConfig?.properties ?? []);

  function onRootChange(next: IVideoAnnotationValue) {
    rootDraft = next;
    onEntryRootChange?.(next);
  }

  function handleFrameChange(next: IVideoAnnotationValue) {
    frameDraft = next;
    onFrameChange?.(next);
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

      {#if rootProperties.length > 0}
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
          <Badge variant={frameAnnotation ? "info" : "success-200"}>{frameAnnotation ? "EDIT" : "CREATE"}</Badge>
          {#if frameAnnotation}
            <div class="ml-auto flex items-center gap-0">
              <CategoryAction
                label={annotation.isHidden(frameAnnotation) ? "Show frame" : "Hide frame"}
                icon={annotation.isHidden(frameAnnotation) ? EyeOffIcon : EyeIcon}
                onclick={() => annotation.toggleHidden(frameAnnotation.id, !annotation.isHidden(frameAnnotation))}
              />
              <CategoryAction
                label={annotation.isLocked(frameAnnotation) ? "Unlock frame" : "Lock frame"}
                icon={annotation.isLocked(frameAnnotation) ? LockIcon : LockOpenIcon}
                onclick={() => annotation.toggleLocked(frameAnnotation.id, !annotation.isLocked(frameAnnotation))}
              />
              <CategoryAction
                label="Delete frame"
                icon={Trash2Icon}
                disabled={disabled}
                onclick={() => onFrameDelete?.()}
              />
            </div>
          {/if}
        </div>

        <CategorySelect
          configValues={frameValues}
          category={frameCategory}
          selectedCategory={frameDraft.category ?? ""}
          shapeType={VIDEO_FRAME}
          onValueChange={(id) => handleFrameChange({ ...frameDraft, category: id })}
          {disabled}
          placeholder="Select a category"
        />

        {#if frameProperties.length > 0}
          <PropertiesSection
            properties={frameProperties}
            annotationValue={frameDraft}
            onValueChange={(property, v) =>
              handleFrameChange({
                ...frameDraft,
                attributes: { ...(frameDraft.attributes ?? {}), [property.id]: v },
              })}
            {disabled}
          />
        {/if}
      </section>
    {/key}
  {/if}
{/if}