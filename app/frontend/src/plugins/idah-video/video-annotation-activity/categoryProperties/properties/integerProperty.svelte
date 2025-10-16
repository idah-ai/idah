<script lang="ts">
  import Input from "@/components/ui/input/input.svelte";
  import Label from "@/components/ui/label/label.svelte";
  import { propertyFullfilled, requiredFullfilled } from "..";

  import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { PropertyField } from "@/plugin/interface/Activity";

  let { property, value, onValueChange }: { property: PropertyField; value: any; onValueChange: (v: any) => void } =
    $props();

  const invalid = $derived(!propertyFullfilled(value, property));
  const format = $derived(invalid ? formatConformity(value, property) : []);
</script>

<div class="my-2 flex flex-col gap-1">
  <Label for={property.id} class="mb-2">
    {property.label}
  </Label>

  <Input
    aria-invalid={invalid}
    id={property.id}
    type="number"
    {value}
    onchange={(e) => onValueChange(e.target.value)}
  />
  {#if invalid}
    <ul>
      {#each format as [k, v]}
        <li style:color="red">{k}:<span>{v}</span></li>
      {/each}
    </ul>
  {/if}
</div>
