<script lang="ts">
  import Label from "@/components/ui/label/label.svelte";
  import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
  import type { PropertyField } from "@/plugin/interface/Activity";
  import type { AnnotationValue } from "@/context/AnnotationContext";

  let {
    property,
    value,
    selectType,
  }: {
    property: PropertyField,
    value : AnnotationValue,
    selectType: 'single'|'multi'
  } = $props()


  let currentValue = $state(value)
  let options = property.format.options

  function changeselection(v) {
    //
  }

</script>


<div>
    <Label>{property.label}</Label>
    <Select type={selectType} onvaluechange={(v) => { console.log(v); changeselection(v)}} onchange={(e) => console.error(e)}>
      <SelectTrigger class="w-[180px]">
        {currentValue.attributes?.[property.id]}
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
