<script lang="ts">
  import Label from "@/components/ui/label/label.svelte";
  import { Select } from "@/components/ui/select";
  import SelectContent from "@/components/ui/select/select-content.svelte";
  import SelectGroup from "@/components/ui/select/select-group.svelte";
  import SelectItem from "@/components/ui/select/select-item.svelte";
  import SelectTrigger from "@/components/ui/select/select-trigger.svelte";

  import type { IConfigProperty } from "@/plugin/interface/Activity";
  import { formatConformity, propertyFullfilled } from "..";

  let {
    property,
    value,
    onValueChange,
  }: {
    property: IConfigProperty;
    value: string;
    onValueChange: (v: string) => void;
  } = $props();

  const options = property.format.options;
  const invalid = $derived(!propertyFullfilled(value, property));
  const format = $derived(invalid ? formatConformity(value, property) : []);
  const formatters = new Map<string, ((v: boolean) => string) | ((v: number) => string)>([
    ["required", (_: boolean) => [property.label, "is required"].join(" ")],
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

  <Select type="single" {value} {onValueChange}>
    <SelectTrigger
      class="data-[placeholder]:text-secondary-foreground bg-secondary w-full text-xs"
      aria-invalid={invalid}
    >
      {options.find(({ id }) => id == value)?.label || "Select property"}
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        {#each options as option (option.id)}
          <SelectItem value={option.id} label={option.label} class="text-xs" />
        {/each}
      </SelectGroup>
    </SelectContent>
  </Select>
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
