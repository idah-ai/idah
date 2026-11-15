<script lang="ts">
	import * as Field from "$lib/components/ui/Field";
  import * as Select from "$lib/components/ui/Select";

  import { formatConformity, propertyFullfilled } from "$lib/components/App/SelectionPanel";

  import type { IConfigProperty } from "$idah/v2/types";

  let {
    property,
    value,
    onValueChange,
    disabled,
    placeholder,
    validationOverride,
  }: {
    property: IConfigProperty;
    value: string[] | undefined;
    onValueChange: (v: string[]) => void;
    disabled: boolean;
    placeholder?: string;
    validationOverride?: boolean;
  } = $props();

  const options = $derived(property.format?.options);
  const invalid = $derived(validationOverride ?? !propertyFullfilled(value, property));
  const format = $derived(invalid ? formatConformity(value, property) : []);
  const formatters = new Map<string, (v: unknown) => string>([
    ["required", (_: unknown) => [property.label, "is required"].join(" ")],
    ["minimum", (v: unknown) => [property.label, "minimum selection:", v].join(" ")],
    ["maximum", (v: unknown) => [property.label, "maximum selection:", v].join(" ")],
    ["step", (v: unknown) => [property.label, "required step", v].join(" ")],
  ]);
</script>

<Field.Field>
  <Field.Label for={property.id} class="text-xs" required={property.required}>
    {property.label}
  </Field.Label>


  <Select.Root type="multiple" {value} {onValueChange} {disabled}>
    <Select.Trigger
      aria-invalid={invalid}
      class="data-placeholder:text-secondary-foreground bg-background w-full text-xs"
      {placeholder}
    >
      {options
        ?.filter(({ id }) => value?.includes(id))
        .map((o) => o.label)
        .join(", ") || placeholder || "Select property"}
    </Select.Trigger>
    <Select.Content>
      <Select.Group>
        {#each options as option (option.id)}
          <Select.Item value={option.id} label={option.label} class="text-xs" />
        {/each}
      </Select.Group>
    </Select.Content>
  </Select.Root>

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
