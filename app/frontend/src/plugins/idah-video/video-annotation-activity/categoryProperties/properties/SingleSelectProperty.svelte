<script lang="ts">
  import Label from "@/components/ui/label/label.svelte";
  import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
  import { formatConformity, propertyFullfilled } from "..";

  import type { PropertyField } from "@/plugin/interface/Activity";

  let {
    property,
    value,
    onValueChange,
  }: {
    property: PropertyField;
    value: string;
    onValueChange: (v: string) => void;
  } = $props();

  const options = property.format.options;
  const invalid = $derived(!propertyFullfilled(value, property));
  const format = $derived(invalid ? formatConformity(value, property) : []);
</script>

<div class="my-2 flex flex-col gap-1">
  <Label for={property.id} class="mb-2">
    {property.label}
  </Label>

  <Select type="single" {value} {onValueChange}>
    <SelectTrigger class="w-full bg-white data-[placeholder]:text-gray-900" aria-invalid={invalid}>
      {value || "Select property"}
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
