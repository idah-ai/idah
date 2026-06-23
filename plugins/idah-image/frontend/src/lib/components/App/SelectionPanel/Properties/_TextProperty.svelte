<script lang="ts">
  import Input from "$lib/components/ui/Input/Input.svelte";
  import Label from "$lib/components/ui/Label/Label.svelte";

  import { formatConformity, propertyFullfilled } from "$lib/components/App/SelectionPanel";

  import type { IConfigProperty } from "$idah/v2/types";

  let {
    property,
    value,
    onValueChange,
    disabled,
  }: {
    property: IConfigProperty;
    value: string;
    onValueChange: (v: string) => void;
    disabled: boolean;
  } = $props();

  const invalid = $derived(!propertyFullfilled(value, property));

  const format = $derived(invalid ? formatConformity(value, property) : []);
  const formatters = new Map<string, (v: unknown) => string>([
    ["required", (_: unknown) => [property.label, "is required"].join(" ")],
    [
      "minimum",
      (v: unknown) =>
        [property.label, "should contains at least", v, ["character", Number(v) > 1 ? "s" : ""].join("")].join(" "),
    ],
    [
      "maximum",
      (v: unknown) =>
        [property.label, "should contains no more than", v, ["character", Number(v) > 1 ? "s" : ""].join("")].join(" "),
    ],
    ["step", (v: unknown) => [property.label, "required step", v].join(" ")],
  ]);
</script>

<div class="flex flex-col gap-1">
  <Label for={property.id} class="text-xs">
    {property.label}
    {#if property.required}
      <span class="text-red-500">*</span>
    {/if}
  </Label>

  <Input type="text" aria-invalid={invalid} {value} onchange={(e) => onValueChange(e.currentTarget.value)} {disabled} />
  {#if invalid}
    <ul class="text-xs">
      {#each format as entry, index (index)}
        {@const [k, v] = entry}
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
