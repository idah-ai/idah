<script lang="ts">
  import { Checkbox } from "@/components/ui/checkbox";
    import Input from "@/components/ui/input/input.svelte";
  import Label from "@/components/ui/label/label.svelte";
  import type { PropertyField } from "@/plugin/interface/Activity";

  let {
    property,
    value
  }: {property: PropertyField, value : AnnotationValue} = $props()

</script>


<div>
    <Label>{property.label}</Label>
    <Input type='text' value={value.attributes?.[property.id]}/>
</div>
