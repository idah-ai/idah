<script lang="ts">
  import Text from "$lib/components/ui/Text/Text.svelte";
  import PropertiesSection from "$lib/components/App/SelectionPanel/_PropertiesSection.svelte";
  import { propertyFullfilled } from "$lib/components/App/SelectionPanel";
  import { bulkPropertyValidity, propertyState, type PropertyValue } from "$lib/utils/bulk-category";
  import { getDriver } from "$lib/state/driver.svelte";
  import type { IAnnotationRecord, IConfigProperty } from "$idah/v2/types";

  let {
    items,
    fields,
    draft,
    draftCategory,
    disabled,
    onValueChange,
  }: {
    items: IAnnotationRecord[];
    fields: IConfigProperty[];
    draft: Record<string, PropertyValue>;
    draftCategory?: string;
    disabled: boolean;
    onValueChange: (id: string, value: PropertyValue) => void;
  } = $props();
</script>

{#if fields.length}
  <section class="flex flex-col gap-4">
    <Text size="sm" weight="semibold">Properties</Text>

    {#each fields as field (field.id)}
      {@const state = propertyState(items, field.id)}
      {@const changed = Object.hasOwn(draft, field.id)}
      {@const value = changed ? draft[field.id] : state.value}
      {@const untouchedMixed = state.mixed && !changed}
      {@const valid = bulkPropertyValidity(items, field, getDriver(), draftCategory, draft, propertyFullfilled)}
      <div class="flex flex-col gap-1">
        <PropertiesSection
          properties={[field]}
          annotationValue={{ properties: { [field.id]: value } }}
          onValueChange={(_, next) => {
            if (typeof next === "number" && Number.isNaN(next)) return;
            onValueChange(field.id, next);
          }}
          showTitle={false}
          placeholder={untouchedMixed ? "Mixed — leave unchanged" : undefined}
          validationOverride={!valid}
          {disabled}
        />
      </div>
    {/each}
  </section>
{/if}
