<script lang="ts">
  import Input from "$lib/components/ui/input/input.svelte";
  import Label from "$lib/components/ui/label/label.svelte";

  import { formatConformity, propertyFullfilled } from "$lib/plugin/video-annotation-activity/category-properties";

  import type { IConfigProperty } from "$idah/context/activity-context";

  let {
    property,
    value,
    onValueChange,
    disabled,
  }: {
    property: IConfigProperty;
    value: number;
    onValueChange: (v: number) => void;
    disabled: boolean;
  } = $props();

  const invalid = $derived(!propertyFullfilled(value, property));
  const format = $derived(invalid ? formatConformity(value, property) : []);
  const formatters = new Map<string, ((v: boolean) => string) | ((v: number) => string)>([
    ["required", (_: boolean) => [property.label, "is required"].join(" ")],
    ["minimum", (v: number) => [property.label, "minimum value:", v].join(" ")],
    ["maximum", (v: number) => [property.label, "maximum value:", v].join(" ")],
    ["step", (v: number) => [property.label, "required step", v].join(" ")],
  ]);
</script>

<div class="flex flex-col gap-1">
  <Label for={property.id} class="text-xs">
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
    onchange={(e) => onValueChange(Number.parseInt(e.target?.value || ""))}
    {disabled}
  />
  {#if invalid}
    <ul class="text-xs">
      {#each format as [k, v] (k)}
        {@const formatter = formatters.get(k)}

        {#if formatter && formatter(v)}
          <li style:color="red">{formatter(v)}</li>
          <!-- {:else}
          <li style:color="red">{k}:<span>{v}</span></li> -->
        {/if}
      {/each}
    </ul>
  {/if}
</div>
