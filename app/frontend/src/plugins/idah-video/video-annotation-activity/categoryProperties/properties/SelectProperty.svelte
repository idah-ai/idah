<script lang="ts">
  import Label from "@/components/ui/label/label.svelte";
  import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
  import type { PropertyField } from "@/plugin/interface/Activity";
  import type { AnnotationValue } from "@/context/AnnotationContext";

  let {
    property,
    value,
    selectType,
    onValueChange,
  }: {
    property: PropertyField,
    value : AnnotationValue,
    onValueChange: (v:any) => void
    selectType: 'single'|'multi'
  } = $props()

  let options = property.format.options

</script>


<div>
  <Label>
    {property.label}
    {#if property.required}
      <i color=red>(required)</i>
    {/if}
  </Label>
  <Select type={selectType}
    value={value.attributes?.[property.id]}
    onValueChange={onValueChange}>
    <SelectTrigger class="w-[180px]">
      {value.attributes?.[property.id]}
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
          {#each options as option (option.id)}
            <SelectItem value={option.id} label={option.label}/>
          {/each}
      </SelectGroup>
    </SelectContent>
  </Select>
</div>
