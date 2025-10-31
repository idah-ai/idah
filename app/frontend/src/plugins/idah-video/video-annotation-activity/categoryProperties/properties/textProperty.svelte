<script lang="ts">
  import Input from "@/components/ui/input/input.svelte";
  import Label from "@/components/ui/label/label.svelte";
  import { formatConformity, propertyFullfilled } from "..";

  import type { PropertyField } from "@/plugin/interface/Activity";

  let {
    property,
    value,
    onValueChange,
  }: { property: PropertyField; value: string; onValueChange: (v: string) => void } = $props();

  const invalid = $derived(!propertyFullfilled(value, property));

  const format = $derived(invalid ? formatConformity(value, property) : []);
</script>

<div class="my-2 flex flex-col gap-1">
  <Label for={property.id} class="mb-2">
    {property.label}
  </Label>

  <Input type="text" aria-invalid={invalid} {value} onchange={(e) => onValueChange(e.target.value)} />
  {#if invalid}
    <ul>
      {#each format as [k, v] (k)}
        <li style:color="red">{k}:<span>{v}</span></li>
      {/each}
    </ul>
  {/if}
</div>
