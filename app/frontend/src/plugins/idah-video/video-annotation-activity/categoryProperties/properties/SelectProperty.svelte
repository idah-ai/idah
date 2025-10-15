<script lang="ts">
  import Label from "@/components/ui/label/label.svelte";
  import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
  import type { PropertyField } from "@/plugin/interface/Activity";
  import type { AnnotationValue } from "@/context/AnnotationContext";
    import { formatConformity, propertyFullfilled } from "..";

  let {
    property,
    value,
    selectType,
    onValueChange,
  }: {
    property: PropertyField,
    value : any,
    onValueChange: (v:any) => void
    selectType: 'single'|'multi'
  } = $props()

  const options = property.format.options
  const invalid = $derived(!propertyFullfilled(value, property))
  const format = $derived(invalid ? formatConformity(value, property): [])
</script>


<div>
  <Label>
    {property.label}
  </Label>
  <Select
    type={selectType}
    aria-invalid={invalid}
    {value}
    onValueChange={onValueChange}>
    <SelectTrigger class="w-[180px]">
      {value}
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
          {#each options as option (option.id)}
            <SelectItem value={option.id} label={option.label}/>
          {/each}
      </SelectGroup>
    </SelectContent>
  </Select>
  {#if invalid}
    <ul>
      {#each format as [k, v]}
        <li style:color=red>{k}:<span>{v}</span></li>
      {/each}
    </ul>
  {/if}
</div>
