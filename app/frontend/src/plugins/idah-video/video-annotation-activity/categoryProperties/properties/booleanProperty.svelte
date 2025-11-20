<script lang="ts">
  import { Label } from "@/components/ui/label";
  import { Switch } from "@/components/ui/switch";
  import { formatConformity, propertyFullfilled } from "..";

  import type { IConfigProperty } from "@/plugin/interface/Activity";

  let {
    property,
    value,
    onValueChange,
  }: { property: IConfigProperty; value: boolean; onValueChange: (v: boolean) => void } = $props();

  const invalid = $derived(!propertyFullfilled(value, property));
  const format = $derived(invalid ? formatConformity(value, property) : []);

  // set default value to false if boolean is required
  if (value == undefined && property.required) onValueChange(false);

  const formatters = new Map<string, ((v: boolean) => string) | ((v: number) => string)>([
    ["required", (_: boolean) => [property.label, "is required"].join(" ")],
  ]);
</script>

<div class="my-2 flex flex-col gap-1">
  <div class="flex items-center space-x-2 text-center">
    <Label for={property.id} class="text-xs">
      {property.label}
      {#if property.required}
        <span class="text-red-500">*</span>
      {/if}
    </Label>

    <Switch aria-invalid={invalid} id={property.id} checked={!!value} onCheckedChange={onValueChange} />
  </div>

  {#if invalid}
    <ul class="text-xs">
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
