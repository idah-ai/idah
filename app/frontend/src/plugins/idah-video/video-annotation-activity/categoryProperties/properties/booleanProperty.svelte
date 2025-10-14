<script lang="ts">
  import { Checkbox } from "@/components/ui/checkbox";
  import { Label } from "@/components/ui/label";
    import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { PropertyField } from "@/plugin/interface/Activity";

  let {
    property,
    value,
    onValueChange,
  }: {property: PropertyField, value : AnnotationValue, onValueChange: (v:any) => void} = $props()
</script>


<div>
    <Label for={property.id}>
      {property.label}
      {#if property.required}
        <i color=red>(required)</i>
      {/if}
    </Label>
    <Checkbox id={property.id}
      checked={!!value.attributes?.[property.id]}
      onCheckedChange={onValueChange} />
</div>
