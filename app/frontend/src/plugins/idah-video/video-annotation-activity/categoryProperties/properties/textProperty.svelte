<script lang="ts">
  import Input from "@/components/ui/input/input.svelte";
  import Label from "@/components/ui/label/label.svelte";
  import { formatConformity, propertyFullfilled } from "..";
  import type { IConfigProperty } from "@/plugin/interface/Activity";

  let {
    property,
    value,
    onValueChange,
  }: { property: IConfigProperty; value: string; onValueChange: (v: string) => void } = $props();

  const invalid = $derived(!propertyFullfilled(value, property));

  const format = $derived(invalid ? formatConformity(value, property) : []);
  const formatters = new Map<string, ((v: boolean) => string) | ((v: number) => string)>([
    ["required", (_: boolean) => [property.label, "is required"].join(" ")],
    [
      "minimum",
      (v: number) =>
        [property.label, "should contains at least", v, ["character", v > 1 ? "s" : ""].join("")].join(" "),
    ],
    [
      "maximum",
      (v: number) =>
        [property.label, "should contains no more than", v, ["character", v > 1 ? "s" : ""].join("")].join(" "),
    ],
    ["step", (v: number) => [property.label, "required step", v].join(" ")],
  ]);
</script>

<div class="my-2 flex flex-col gap-1">
  <Label for={property.id} class="mb-2 text-xs">
    {property.label}
    {#if property.required}
      <span class="text-red-500">*</span>
    {/if}
  </Label>

  <Input type="text" aria-invalid={invalid} {value} onchange={(e) => onValueChange(e.target.value)} />
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
