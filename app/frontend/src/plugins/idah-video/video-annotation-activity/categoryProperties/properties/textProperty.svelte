<script lang="ts">
  import { Checkbox } from "@/components/ui/checkbox";
  import Input from "@/components/ui/input/input.svelte";
  import Label from "@/components/ui/label/label.svelte";
  import type { PropertyField } from "@/plugin/interface/Activity";
  import { formatConformity, propertyFullfilled } from "..";
  import type { AnnotationValue } from "@/context/AnnotationContext";

  let {
    property,
    value,
    onValueChange
  }: {property: PropertyField, value : any, onValueChange: (v:any) => void} = $props()

  const invalid = $derived(!propertyFullfilled(value, property))

  const format = $derived(invalid ? formatConformity(value, property): [])
</script>



<div>
  <Label>
    {property.label}
  </Label>
  <Input
    type='text'
    aria-invalid={invalid}
    {value}
    onchange={(e) => onValueChange(e.target.value)}
    />
  {#if invalid}
    <ul>
      {#each format as [k, v]}
        <li style:color=red>{k}:<span>{v}</span></li>
      {/each}
    </ul>
  {/if}
</div>
