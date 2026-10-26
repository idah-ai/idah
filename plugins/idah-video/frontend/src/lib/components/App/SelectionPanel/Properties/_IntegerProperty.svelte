<script lang="ts">
  import Input from "$lib/components/ui/Input/Input.svelte";
  import * as Field from "$lib/components/ui/Field";

  import { formatConformity, propertyFullfilled } from "$lib/components/App/SelectionPanel";

  import type { IConfigProperty } from "$idah/v2/types";

  interface Props {
    property: IConfigProperty;
    value: number;
    onValueChange: (v: number) => void;
    disabled: boolean;
    placeholder?: string;
  }

  let { property, value, onValueChange, disabled, placeholder }: Props = $props();

  const invalid = $derived(!propertyFullfilled(value, property));
  const format = $derived(invalid ? formatConformity(value, property) : []);
  const formatters = new Map<string, (v: unknown) => string>([
    ["required", (_: unknown) => [property.label, "is required"].join(" ")],
    ["minimum", (v: unknown) => [property.label, "minimum value:", v].join(" ")],
    ["maximum", (v: unknown) => [property.label, "maximum value:", v].join(" ")],
    ["step", (v: unknown) => [property.label, "required step", v].join(" ")],
  ]);
</script>

<Field.Field>
  <Field.Label for={property.id} class="text-xs" required={property.required}>
    {property.label}
  </Field.Label>

  <Input
    id={property.id}
    aria-invalid={invalid}
    class="placeholder:text-xs"
    type="number"
    min={property.format?.minimum}
    max={property.format?.maximum}
    step={property.format?.step || "1"}
    {disabled}
    {placeholder}
    {value}
    onchange={(e) => onValueChange(e.currentTarget.valueAsNumber)}
  />

  {#if property.description}
    <Field.Description class="text-[10px]">{property.description}</Field.Description>
  {/if}

  {#if invalid}
    <ul class="text-xs">
      {#each format as entry, index (index)}
        {@const [k, v] = entry}
        {@const formatter = formatters.get(k)}

        {#if formatter && formatter(v)}
          <li style:color="red">{formatter(v)}</li>
        {/if}
      {/each}
    </ul>
  {/if}
</Field.Field>
