<script lang="ts">
  import Input from "@/components/ui/input/input.svelte";
  import Label from "@/components/ui/label/label.svelte";
  import { formatConformity, propertyFullfilled } from "..";

  import type { PropertyField } from "@/plugin/interface/Activity";

  let {
    property,
    value,
    onValueChange,
  }: { property: PropertyField; value: number; onValueChange: (v: number) => void } = $props();

  const invalid = $derived(!propertyFullfilled(value, property));
  const format = $derived(invalid ? formatConformity(value, property) : []);
  const formatters = new Map([
    // probably need fixing on requirement same as boolean for value = 0
    ["required", (v: any) => [property.label, "is required"].join(" ")],
    ["minimum", (v: any) => [property.label, "minimum value:", v].join(" ")],
    ["maximum", (v: any) => [property.label, "maximum value:", v].join(" ")],
    ["step", (v: any) => [property.label, "required step", v].join(" ")],
  ]);
</script>

<div class="my-2 flex flex-col gap-1">
  <Label for={property.id} class="mb-2 text-xs">
    {property.label}
    {#if property.required}
      <span class="text-red-500">*</span>
    {/if}
  </Label>

  <Input
    aria-invalid={invalid}
    id={property.id}
    type="number"
    min={property.format?.minimum}
    max={property.format?.maximum}
    step={property.format?.step || "1"}
    {value}
    onchange={(e) => onValueChange(e.target?.value)}
  />
  {#if invalid}
    <ul>
      {#each format as [k, v] (k)}
        {@const formatter = formatters.get(k)}

        {#if formatter && formatter(v)}
          <li style:color="red">{formatter(v)}</li>
        {:else}
          <li style:color="red">{k}:<span>{v}</span></li>
        {/if}
      {/each}
    </ul>
  {/if}
</div>
