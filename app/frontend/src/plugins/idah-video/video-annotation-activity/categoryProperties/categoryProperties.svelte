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

  type Props = {
    selectedCategory: string,
    selectedId: string,
    onSelectCategory: (category?: CategoryDefinition) => void,
    onEditValue: (value?: AnnotationValue) => void,
    db?: AnnotationsIndexedDB,
  };

  let {
    selectedCategory,
    selectedId,
    onSelectCategory,
    onEditValue,
    db,
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

  function visibleFullfilled(p: PropertyField, v: AnnotationValue){
    // check visibility condition
    return true
  }

  function requiredFullfilled(value:AnnotationValue):boolean {
    const required_properties = properties().filter(p => p.required)

    // todo account for visibility/required

    return required_properties.every(p => {
      !!value.attributes?.[p.id] // && conform to format
    })
  }

  function onValueChange(
    property: PropertyField,
    selected: AnnotationValue,
    v: any
  ){
    console.log({onValueChanged:{property, selected, v}})
    if (!selected.value.attributes) selected.value.attributes = {}

    selected.value.attributes[property.id] = v
    onEditValue(selected.value)
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


    {#await selectedPromise()}
      awaiting selected
    {:then selected}
      {#if !selected}
        <!-- annotation to display not found -->
      {:else}
        {#each properties() as property (property.id)}
          {@const pc = propertyComponents.find(p => p.type == property.type)}

          {#if pc && visibleFullfilled(property, selected.value)}
            <svelte:component
              this={pc.component}
              {...{
                property,
                ...pc.extraProps,
                value: selected.value,
                onValueChange: (v:any) => onValueChange(property, selected, v)
                }} />
          {/if}
        {/each}
      {/if}
    {:catch}
        could not retrieve selected from selectedId={selectedId}
    {/await}
  {/key}
</div>
