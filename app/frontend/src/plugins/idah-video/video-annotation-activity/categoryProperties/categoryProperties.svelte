<script lang="ts">
  import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
  import SelectGroup from "@/components/ui/select/select-group.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import { getContext } from "svelte";

  import { visibilityFullfilled } from ".";
  import { idb_updated_at } from "../idb_store.svelte";
  import BooleanProperty from "./properties/booleanProperty.svelte";
  import IntegerProperty from "./properties/integerProperty.svelte";
  import TextProperty from "./properties/textProperty.svelte";

  import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { IActivityContext, IConfigProperty } from "@/plugin/interface/Activity";
  import MultiSelectProperty from "./properties/MultiSelectProperty.svelte";
  import SingleSelectProperty from "./properties/SingleSelectProperty.svelte";

  type Props = {
    type: string;
    selectedCategory: string;
    annotationValue: AnnotationValue;
    onSelectCategory: (id?: string) => void;
    onEditValue: (value?: AnnotationValue) => void;
    disabled: boolean;
  };

  let { type, selectedCategory, annotationValue, onSelectCategory, onEditValue, disabled }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");
  const typeConfig = context.config[type];
  const category = typeConfig?.values.find((c) => c.id == selectedCategory);
  const properties = typeConfig?.properties.filter((p) => visibilityFullfilled(annotationValue, p));

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

  function onValueChange(property: IConfigProperty, v: string | number | string[] | undefined | boolean) {
    const newValue = {
      ...annotationValue,
      attributes: {
        ...(annotationValue.attributes || {}),
        [property.id]: v,
      },
    };
    const new_visible_properties = typeConfig?.properties
      .filter((p) => visibilityFullfilled(newValue, p))
      .map((p) => p.id);
    const visibilityDiff = Object.keys(newValue.attributes).filter((k) => !new_visible_properties.includes(k));
    // remove visibility false properties
    if (visibilityDiff.length) visibilityDiff.forEach((p) => delete newValue.attributes?.[p]);
    onEditValue(newValue);
  }
</script>

<div>
  <div class="flex pb-1">
    <Text class="text-muted-foreground" weight="medium" size="xs">BKDHJKSHFDJKSDHFJKS</Text>
  </div>
  {#key $idb_updated_at}
    <Select type="single" onValueChange={onSelectCategory} {disabled}>
      <SelectTrigger class="data-[placeholder]:text-secondary-foreground bg-secondary w-full text-xs">
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

    <hr class="my-3 border-t border-gray-200" />

    {#if category && properties?.length > 0}
      <div class="flex pb-1">
        <Text class="text-muted-foreground" weight="medium" size="xs">Properties</Text>
      </div>

      {#each properties as property (property.id)}
        {@const pc = propertyComponents.find((p) => p.type == property.type)}

        {#if pc}
          <div class="flex flex-col gap-2">
            <pc.component
              {...{
                property,
                value: annotationValue.attributes?.[property.id],
                onValueChange: (v: string | number | boolean | string[] | undefined) => onValueChange(property, v),
                disabled,
              }}
            />
          </div>
        {/if}
      {/each}
    {/if}
  {/key}
</div>
