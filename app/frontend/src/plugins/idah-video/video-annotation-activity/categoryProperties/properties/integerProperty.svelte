<script lang="ts">
  import Input from "@/components/ui/input/input.svelte";
  import Label from "@/components/ui/label/label.svelte";
    import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { PropertyField } from "@/plugin/interface/Activity";
    import { propertyFullfilled, requiredFullfilled } from "..";

  let {
    property,
    value,
    onValueChange,
  }: {property: PropertyField, value : any, onValueChange: (v:any) => void} = $props()

  const invalid = $derived(!propertyFullfilled(value, property))
  const format = $derived(invalid ? formatConformity(value, property): [])
</script>


<div>
  <Label for={property.id}>
    {property.label}
  </Label>
  <Input
    aria-invalid={invalid}
    id={property.id}
    type='number'
    value={value}
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
