<script lang="ts">
  import { Checkbox } from "@/components/ui/checkbox";
  import { Label } from "@/components/ui/label";
    import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { PropertyField } from "@/plugin/interface/Activity";
    import { propertyFullfilled } from "..";

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
  <Checkbox
    aria-invalid={invalid}
    id={property.id}
    checked={!!value}
    onCheckedChange={onValueChange} />
  {#if invalid}
    <ul>
      {#each format as [k, v]}
        <li style:color=red>{k}:<span>{v}</span></li>
      {/each}
    </ul>
  {/if}
</div>
