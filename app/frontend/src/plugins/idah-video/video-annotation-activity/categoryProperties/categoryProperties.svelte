<script lang="ts">
  import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
  import SelectGroup from "@/components/ui/select/select-group.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import { getContext, type Component } from "svelte";

  import { visibleFullfilled } from ".";
  import { idb_updated_at } from "../idb_store.svelte";
  import BooleanProperty from "./properties/booleanProperty.svelte";
  import IntegerProperty from "./properties/integerProperty.svelte";
  import SelectProperty from "./properties/SelectProperty.svelte";
  import TextProperty from "./properties/textProperty.svelte";

  import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { IActivityContext, PropertyField } from "@/plugin/interface/Activity";

  type Props = {
    selectedCategory: string;
    annotationValue: AnnotationValue;
    onSelectCategory: (id?: string) => void;
    onEditValue: (value?: AnnotationValue) => void;
  };

  let { selectedCategory, annotationValue, onSelectCategory, onEditValue }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");
  const category = () => context.config.categories.find((c) => c.id == selectedCategory);
  const properties = () =>
    context.config.properties.filter((p) =>
      p.selector.some(
        (s) => selectedCategory === s || s === selectedCategory + "/*" || s === selectedCategory.split("/")[0] + "/*",
      ),
    );

  const propertyComponents: {
    type: string;
    component: Component<any, {}, "">;
    extraProps?: object;
  }[] = [
    { type: "text", component: TextProperty },
    { type: "integer", component: IntegerProperty },
    { type: "boolean", component: BooleanProperty },
    {
      type: "single-select",
      component: SelectProperty,
      extraProps: {
        selectType: "single",
      },
    },
    {
      type: "multi-select",
      component: SelectProperty,
      extraProps: {
        selectType: "multi",
      },
    },
  ];

  function onValueChange(property: PropertyField, v: any) {
    onEditValue({
      ...annotationValue,
      attributes: { ...(annotationValue.attributes || {}), [property.id]: v },
    });
  }
</script>

<div>
  <div class="flex pb-1">
    <Text class="text-gray-500" weight="medium" size="sm">Category</Text>
  </div>
  {#key $idb_updated_at}
    <Select type="single" onValueChange={onSelectCategory}>
      <SelectTrigger class="w-full bg-white data-[placeholder]:text-gray-900">
        {category()?.label}
      </SelectTrigger>

      <SelectContent>
        <SelectGroup>
          {#each context.config.categories as c (c.id)}
            <SelectItem value={c.id} label={c.label}>
              {c.label}
            </SelectItem>
          {/each}
        </SelectGroup>
      </SelectContent>
    </Select>

    <hr class="my-3 border-t border-gray-200" />

    {#if properties().length > 0}
      <div class="flex pb-1">
        <Text class="text-gray-500" weight="medium" size="sm">Properties</Text>
      </div>

      {#each properties() as property (property.id)}
        {@const pc = propertyComponents.find((p) => p.type == property.type)}

        {#if pc && visibleFullfilled(property)}
          <div class="flex flex-col gap-2">
            <pc.component
              {...{
                property,
                ...pc.extraProps,
                value: annotationValue.attributes?.[property.id],
                onValueChange: (v: any) => onValueChange(property, v),
              }}
            />
          </div>
        {/if}
      {/each}
    {/if}
  {/key}
</div>
