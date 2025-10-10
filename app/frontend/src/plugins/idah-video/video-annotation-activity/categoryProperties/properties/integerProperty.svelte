<script lang="ts">
  import Input from "@/components/ui/input/input.svelte";
  import Label from "@/components/ui/label/label.svelte";
    import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { PropertyField } from "@/plugin/interface/Activity";

  let {
    property,
    value,
    onValueChange,
  }: {property: PropertyField, value : AnnotationValue, onValueChange: (v:any) => void} = $props()
</script>


<div>
    <Label for={property.id}>{property.label}</Label>
    <Input id={property.id} type='number' value={value.attributes?.[property.id]} onchange={(e) => onValueChange(e.target.value)}/>
</div>
