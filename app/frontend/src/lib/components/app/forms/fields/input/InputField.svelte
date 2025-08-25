<script lang="ts">
	import FormField from "$lib/components/app/forms/FormField.svelte";
	import FormFieldErrors from "$lib/components/app/forms/FormFieldErrors.svelte";
	import FormFieldInfo from "$lib/components/app/forms/FormFieldInfo.svelte";
	import FormFieldLabel from "$lib/components/app/forms/FormFieldLabel.svelte";
	import Input from "@/components/ui/input/input.svelte";

	import { cn } from "@/utils";

	import type { FormFieldBaseProps } from "$lib/components/app/forms/FormField.types";

	// Props
	interface Props extends FormFieldBaseProps {
		value: string | null;
	}
	let {
		value = $bindable(null),
		name,
		label,
		placeholder,
		disabled = false,
		required = false,
		readonly,
		info,
		errors,
		class: className,
		slotLabel,
		slotInfo,
		slotErrors,
	}: Props = $props();
</script>

<FormField class={cn("", className)}>
	{#if slotLabel}
		{@render slotLabel()}
	{:else}
		<FormFieldLabel {required}>{label}</FormFieldLabel>
	{/if}

	<Input {name} {placeholder} {disabled} {readonly} {required} bind:value />

	{#if slotInfo}
		{@render slotInfo()}
	{:else}
		<FormFieldInfo>{info}</FormFieldInfo>
	{/if}

	{#if slotErrors}
		{@render slotErrors()}
	{:else}
		<FormFieldErrors {errors}></FormFieldErrors>
	{/if}
</FormField>
