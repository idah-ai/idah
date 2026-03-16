<script lang="ts">
  import { getContext } from "svelte";

  import BooleanProperty from "$lib/components/app/sidebar/properties/boolean-property.svelte";
  import IntegerProperty from "$lib/components/app/sidebar/properties/integer-property.svelte";
  import MultiSelectProperty from "$lib/components/app/sidebar/properties/multi-select-property.svelte";
  import SingleSelectProperty from "$lib/components/app/sidebar/properties/single-select-property.svelte";
  import TextProperty from "$lib/components/app/sidebar/properties/text-property.svelte";
  import { visibilityFullfilled } from "$lib/components/app/sidebar/properties/utils";
  import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "$lib/components/ui/field";
  import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "$lib/components/ui/select";

  import type { AnnotationValue } from "$lib/context/AnnotationContext";
  import type { IActivityContext } from "$lib/context/context";

  // Type Props
  type Props = {
    type: string;
    selectedCategory: string;
    annotationValue: AnnotationValue;
    onSelectCategory: (id?: string) => void;
    disabled: boolean;
  };

  // Props
  let { type, selectedCategory, annotationValue, onSelectCategory, disabled }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");
  const typeConfig = context.config?.[type];
  const category = typeConfig?.values.find((c) => c.id == selectedCategory);
  const properties = typeConfig?.properties.filter((p) => visibilityFullfilled(annotationValue, p));

  // Variables
  const propertyComponents: {
    type: string;
    component:
      | typeof TextProperty
      | typeof IntegerProperty
      | typeof BooleanProperty
      | typeof SingleSelectProperty
      | typeof MultiSelectProperty;
  }[] = [
    { type: "text", component: TextProperty },
    { type: "integer", component: IntegerProperty },
    { type: "boolean", component: BooleanProperty },
    { type: "single-select", component: SingleSelectProperty },
    { type: "multi-select", component: MultiSelectProperty },
  ];
</script>

<FieldGroup>
  <Field>
    <FieldLabel>Category</FieldLabel>

    <Select type="single" onValueChange={onSelectCategory} {disabled}>
      <SelectTrigger class="data-[placeholder]:text-secondary-foreground bg-secondary w-full truncate text-xs">
        {category?.label || "Select category"}
      </SelectTrigger>

      <SelectContent>
        <SelectGroup>
          {#each typeConfig.values as c (c.id)}
            <SelectItem value={c.id} label={c.label} class="text-xs">
              {c.label}
            </SelectItem>
          {/each}
        </SelectGroup>
      </SelectContent>
    </Select>
  </Field>

  <hr class="my-3 border-t border-gray-200" />
  {#if category && properties?.length > 0}
    <FieldSet>
      <FieldLegend>Properties</FieldLegend>

      {#each properties as property (property.id)}
        {@const pc = propertyComponents.find((p) => p.type == property.type)}

        {#if pc}
          <div class="flex flex-col gap-2">
            <pc.component
              {...{
                property,
                disabled,
              }}
            />
          </div>
        {/if}
      {/each}
    </FieldSet>
  {/if}
</FieldGroup>
