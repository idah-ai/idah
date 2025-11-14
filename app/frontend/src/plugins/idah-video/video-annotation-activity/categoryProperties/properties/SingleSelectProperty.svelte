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
</script>

<div class="my-2 flex flex-col gap-1">
  <Label for={property.id} class="mb-2 text-xs">
    {property.label}
  </Label>

  <Select type="single" {value} {onValueChange}>
    <SelectTrigger class="data-[placeholder]:text-secondary-foreground bg-secondary w-full" aria-invalid={invalid}>
      {options.find(({ id }) => id == value)?.label || "Select property"}
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        {#each options as option (option.id)}
          <SelectItem value={option.id} label={option.label} />
        {/each}
      </SelectGroup>
    </SelectContent>
  </Select>
  {#if invalid}
    <ul>
      {#each format as [k, v] (k)}
        <li style:color="red">{k}:<span>{v}</span></li>
      {/each}
    </ul>
  {/if}
</div>
