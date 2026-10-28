<script lang="ts">
  import Text from "$lib/components/ui/Text/Text.svelte";
  import PropertiesSection from "$lib/components/App/SelectionPanel/_PropertiesSection.svelte";
  import { propertyState, type PropertyValue } from "$lib/utils/bulk-category";
  import type { IAnnotationRecord, IConfigProperty } from "$idah/v2/types";

  let {
    items,
    fields,
    draft,
    disabled,
    onValueChange,
    onReset,
  }: {
    items: IAnnotationRecord[];
    fields: IConfigProperty[];
    draft: Record<string, PropertyValue>;
    disabled: boolean;
    onValueChange: (id: string, value: PropertyValue) => void;
    onReset: (id: string) => void;
  } = $props();

  function resetField(id: string) {
    onReset(id);
  }
</script>

{#if fields.length}
  <section class="flex flex-col gap-4">
    <Text size="sm" weight="semibold">Properties</Text>

    {#each fields as field (field.id)}
      {@const state = propertyState(items, field.id)}
      {@const changed = Object.hasOwn(draft, field.id)}
      {@const value = changed ? draft[field.id] : state.value}
      {@const untouchedMixed = state.mixed && !changed}
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
          {disabled}
        />

        <!-- {#if !field.required && field.type !== "single-select" && !changed}
          <Button
            variant="ghost"
            size="sm"
            class="self-start"
            {disabled}
            onclick={() => onValueChange(field.id, undefined)}
          >
            Remove property
          </Button>
        {/if} -->

        <!-- {#if changed}
          <Button variant="ghost" size="sm" class="self-start" onclick={() => resetField(field.id)}>
            Keep original values
          </Button>
        {/if} -->
      </div>
    {/each}
  </section>
{/if}
