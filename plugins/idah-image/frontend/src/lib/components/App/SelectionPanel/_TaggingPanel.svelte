<script lang="ts">
  import Text from "$lib/components/ui/Text/Text.svelte";
  import Badge from "$lib/components/ui/Badge/Badge.svelte";
  import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

  import CategorySelect from "$lib/components/App/SelectionPanel/_CategorySelect.svelte";
  import PropertiesSection from "$lib/components/App/SelectionPanel/_PropertiesSection.svelte";
  import CategoryAction from "$lib/components/App/CategorySelector/Category/_CategoryAction.svelte";

  import { getDriver } from "$lib/state/driver.svelte";
  import { annotation } from "$lib/state/annotation.svelte";

  import { ENTRY_ROOT, type IImageAnnotationRecord, type IImageAnnotationValue } from "$lib/types";

  type Props = {
    entryRootAnnotation: IImageAnnotationRecord | undefined;
    /** Returns whether the change was persisted (false when a required field is missing). */
    onCreateOrUpdate?: (value: IImageAnnotationValue) => boolean;
    onDelete?: () => void;
    disabled: boolean;
  };

  let { entryRootAnnotation, onCreateOrUpdate, onDelete, disabled }: Props = $props();

  const shapeType = ENTRY_ROOT;

  // Local draft value so the form is controlled even before an annotation
  // exists. Synced from the existing annotation so edits to an existing
  // entry:root record are reflected here.
  let draftValue = $state<IImageAnnotationValue>({});
  // Visible feedback when a change can't be saved because a required field is
  // missing. The draft still shows the user's edit, but the record is unchanged.
  let saveError = $state<string | null>(null);
  $effect(() => {
    const v = entryRootAnnotation?.value;
    draftValue = v ? { ...v } : {};
  });

  const config = $derived(getDriver().getFilteredConfig(shapeType, draftValue as unknown as Record<string, unknown>));
  const configValues = $derived(config?.values ?? []);
  const category = $derived(configValues.find((c) => c.id === draftValue.category));
  const properties = $derived(config?.properties ?? []);

  function onChange(next: IImageAnnotationValue) {
    draftValue = next;
    saveError = null;
    if (onCreateOrUpdate?.(next) === false) {
      saveError = "Complete the required fields to save the image tagging.";
    }
  }
</script>

{#if config}
  <section class="flex flex-col gap-3">
    {#if saveError}
      <p class="bg-destructive/10 text-destructive rounded-md px-2 py-1 text-xs">{saveError}</p>
    {/if}
    <div class="flex items-center gap-2">
      <Text weight="semibold">Image</Text>
      <Badge variant={entryRootAnnotation ? "info" : "success-200"}>{entryRootAnnotation ? "EDIT" : "CREATE"}</Badge>
      {#if entryRootAnnotation}
        <div class="ml-auto flex items-center gap-0">
          <CategoryAction
            label={annotation.isHidden(entryRootAnnotation) ? "Show image tag" : "Hide image tag"}
            icon={annotation.isHidden(entryRootAnnotation) ? EyeOffIcon : EyeIcon}
            onclick={() => annotation.toggleHidden(entryRootAnnotation.id, !annotation.isHidden(entryRootAnnotation))}
          />
          <CategoryAction
            label={annotation.isLocked(entryRootAnnotation) ? "Unlock image tag" : "Lock image tag"}
            icon={annotation.isLocked(entryRootAnnotation) ? LockIcon : LockOpenIcon}
            onclick={() => annotation.toggleLocked(entryRootAnnotation.id, !annotation.isLocked(entryRootAnnotation))}
          />
          <CategoryAction
            label="Delete image tag"
            icon={Trash2Icon}
            disabled={disabled}
            onclick={() => onDelete?.()}
          />
        </div>
      {/if}
    </div>

    <CategorySelect
      {configValues}
      {category}
      selectedCategory={draftValue.category ?? ""}
      {shapeType}
      onValueChange={(id) => onChange({ ...draftValue, category: id })}
      {disabled}
      placeholder="Select a category"
    />

    {#if draftValue.category && properties.length > 0}
      <PropertiesSection
        {properties}
        annotationValue={draftValue}
        onValueChange={(property, v) =>
          onChange({
            ...draftValue,
            attributes: { ...(draftValue.attributes ?? {}), [property.id]: v },
          })}
        {disabled}
      />
    {/if}
  </section>
{:else}
  <Text size="sm" class="text-muted-foreground">
    No entry-level or frame-level tagging is configured for this dataset.
  </Text>
{/if}
