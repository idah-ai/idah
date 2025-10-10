<script lang="ts">
  import { Checkbox } from "@/components/ui/checkbox";
  import { Label } from "@/components/ui/label";
    import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { PropertyField } from "@/plugin/interface/Activity";

  let {
    property,
    value
  }: {property: PropertyField, value: AnnotationValue} = $props()
</script>


<div>
    <Label for={property.id}>{property.label}</Label>
    <Checkbox id={property.id} value={value.attributes?.[property.id]}/>
</div>
