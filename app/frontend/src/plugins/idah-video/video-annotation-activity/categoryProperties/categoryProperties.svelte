<script lang=ts>
    import { getContext, SvelteComponent } from "svelte";
    import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
    import SelectGroup from "@/components/ui/select/select-group.svelte";
    import type { CategoryDefinition } from "@/context/ActivityContext";
    import type { IActivityContext, PropertyField } from "@/plugin/interface/Activity";
    import Text from "@/components/ui/text/Text.svelte";
    import type { AnnotationsIndexedDB } from "../indexedDB";

    import TextProperty from "./properties/textProperty.svelte";
    import IntegerProperty from "./properties/integerProperty.svelte";
    import BooleanProperty from "./properties/booleanProperty.svelte";
    import SelectProperty from "./properties/SelectProperty.svelte";
    import type { AnnotationValue } from "@/context/AnnotationContext";
    import { idb_updated_at } from "../idb_store.svelte";
    import { visibleFullfilled } from ".";

  type Props = {
    selectedCategory: string,
    selectedId: string,
    annotationValue: AnnotationValue,
    onSelectCategory: (category?: CategoryDefinition) => void,
    onEditValue: (value?: AnnotationValue) => void,
  };

  let {
    selectedCategory,
    selectedId,
    annotationValue,
    onSelectCategory,
    onEditValue,
  }:Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");
  const category = () => context.config.categories.find(c => c.id == selectedCategory)
  const properties = () => context.config.properties.filter(
    (p) => p.selector.includes(selectedCategory)
  )

  console.log({selectedCategory, selectedId, category});

  type propertyComponent = TextProperty|IntegerProperty|BooleanProperty

  const propertyComponents: {
    type: string, component: propertyComponent, extraProps?:{}
  }[] = [
    {type: 'text', component: TextProperty },
    {type: 'integer', component: IntegerProperty },
    {type: 'boolean', component: BooleanProperty },
    {type: 'single-select', component: SelectProperty, extraProps: {
      selectType: 'single'
    }},
    {type: 'multi-select', component: SelectProperty ,  extraProps: {
      selectType: 'multi'
    }}
  ]

  const selectedPromise = () => db?.get('annotations', selectedId)

  function onValueChange(
    property: PropertyField,
    v: any
  ){
    onEditValue({
      ...annotationValue,
      attributes: { ...(annotationValue.attributes || {}), [property.id]: v }
    })
  }
</script>

<div>
  <div class="flex pb-1">
    <Text class="text-gray-700" weight="medium" size="sm">Category</Text>
  </div>
  {#key $idb_updated_at}
    <Select
      type="single"
      onValueChange={onSelectCategory}>
      <SelectTrigger class="w-full">
        {category()?.label}
        <!-- {@render showCategoryTitle(selectedCategory, false, false)} -->
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {#each context.config.categories as c (c.id)}
              <SelectItem value={c} label={c.label}>
                {c.label}
              </SelectItem>
          {/each}
        </SelectGroup>
      </SelectContent>
    </Select>


    {#each properties() as property (property.id)}
      {@const pc = propertyComponents.find(p => p.type == property.type)}

      {#if pc && visibleFullfilled(property)}
        <pc.component
          {...{
            property,
            ...pc.extraProps,
            value: annotationValue,
            onValueChange: (v:any) => onValueChange(property, v)
          }} />
      {/if}
    {/each}
  {/key}
</div>
