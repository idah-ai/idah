<script lang="ts">
  import { Checkbox } from "@/components/ui/checkbox";
    import Input from "@/components/ui/input/input.svelte";
  import Label from "@/components/ui/label/label.svelte";
  import type { PropertyField } from "@/plugin/interface/Activity";

  let {
    property,
    value,
    onValueChange
  }: {property: PropertyField, value : AnnotationValue, onValueChange: (v:any) => void} = $props()

</script>


<div>
    <Label>{property.label}</Label>
    <Input type='text' value={value.attributes?.[property.id]} onchange={(e) => onValueChange(e.target.value)}/>
</div>
