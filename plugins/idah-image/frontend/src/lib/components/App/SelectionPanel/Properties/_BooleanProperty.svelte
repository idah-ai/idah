<script lang="ts">
	import * as Field from "$lib/components/ui/Field";
  import Switch from "$lib/components/ui/Switch/Switch.svelte";

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
    value: boolean | undefined;
    onValueChange: (v: boolean) => void;
    disabled: boolean;
    placeholder?: string;
    validationOverride?: boolean;
  } = $props();

  const invalid = $derived(validationOverride ?? !propertyFullfilled(value, property));
  const format = $derived(invalid ? formatConformity(value, property) : []);

  let checked = $derived(value ?? false);

  const formatters = new Map<string, (v: unknown) => string>([
    ["required", (_: unknown) => [property.label, "is required"].join(" ")],
  ]);
</script>

<Field.Field>
	<div class="flex gap-2">
		<Switch id={property.id} aria-invalid={invalid} checked={checked} onCheckedChange={onValueChange} {disabled} />

		<div class="flex flex-col">
	    <Field.Label for={property.id} class="text-xs" required={property.required}>
	      {property.label}
	    </Field.Label>

			{#if placeholder || property.description}
		    <Field.Description class="text-[10px]">{placeholder || property.description}</Field.Description>
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
		</div>
	</div>
</Field.Field>
