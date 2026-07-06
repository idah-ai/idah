<script lang="ts">
  import Text from "$lib/components/ui/Text/Text.svelte";

  import BooleanProperty from "$lib/components/App/SelectionPanel/Properties/_BooleanProperty.svelte";
  import IntegerProperty from "$lib/components/App/SelectionPanel/Properties/_IntegerProperty.svelte";
  import MultipleSelectProperty from "$lib/components/App/SelectionPanel/Properties/_MultipleSelectProperty.svelte";
  import SingleSelectProperty from "$lib/components/App/SelectionPanel/Properties/_SingleSelectProperty.svelte";
  import TextProperty from "$lib/components/App/SelectionPanel/Properties/_TextProperty.svelte";

  import type { IConfigProperty } from "$idah/v2/types";
  import type { IImageAnnotationValue } from "$lib/types";

  type Props = {
    properties: IConfigProperty[];
    annotationValue: IImageAnnotationValue;
    onValueChange: (property: IConfigProperty, value: string | number | string[] | boolean | undefined) => void;
    disabled: boolean;
  };

  let { properties, annotationValue, onValueChange, disabled }: Props = $props();
</script>

<section class="flex flex-col gap-2">
  <div class="flex flex-row items-center gap-2">
    <Text size="sm" weight="semibold">Properties</Text>
  </div>
  {#each properties as property, i (`${property.id}-${i}`)}
    <div class="flex flex-col gap-1">
      {#if property.type === "text"}
        <TextProperty
          {property}
          value={annotationValue.attributes?.[property.id] as any}
          onValueChange={(v: any) => onValueChange(property, v)}
          {disabled}
        />
      {:else if property.type === "integer"}
        <IntegerProperty
          {property}
          value={annotationValue.attributes?.[property.id] as any}
          onValueChange={(v: any) => onValueChange(property, v)}
          {disabled}
        />
      {:else if property.type === "boolean"}
        <BooleanProperty
          {property}
          value={annotationValue.attributes?.[property.id] as any}
          onValueChange={(v: any) => onValueChange(property, v)}
          {disabled}
        />
      {:else if property.type === "single-select"}
        <SingleSelectProperty
          {property}
          value={annotationValue.attributes?.[property.id] as any}
          onValueChange={(v: any) => onValueChange(property, v)}
          {disabled}
        />
      {:else if property.type === "multi-select"}
        <MultipleSelectProperty
          {property}
          value={annotationValue.attributes?.[property.id] as any}
          onValueChange={(v: any) => onValueChange(property, v)}
          {disabled}
        />
      {/if}
    </div>
  {/each}
</section>
