<script lang="ts">
	import { format } from "date-fns";

	import Button from "@/components/ui/button/button.svelte";
	import Calendar from "@/components/ui/calendar/calendar.svelte";
	import FormField from "@/components/app/forms/FormField.svelte";
	import FormFieldLabel from "@/components/app/forms/FormFieldLabel.svelte";
	import FormFieldInfo from "@/components/app/forms/FormFieldInfo.svelte";
	import FormFieldErrors from "@/components/app/forms/FormFieldErrors.svelte";
	import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

	import { cn } from "@/utils";
	import { CalendarIcon } from "@lucide/svelte";
	import { CalendarDate, DateFormatter, getLocalTimeZone, type DateValue } from "@internationalized/date";

	import type { DateFieldBaseProps } from "@/components/app/forms/fields/picker/DateField.types";

	// Props
	interface Props extends DateFieldBaseProps {
		value: Date | null | undefined;
	}
	let {
		name,
		label,
		placeholder = "Select a date",
		placeholderDateFormat,
		dateStyle = "medium",
		required = false,
		disabled = false,
		value = $bindable(null),
		info,
		errors,
		class: className,
		onDateSelected,
		slotLabel,
		slotInfo,
		slotErrors,
	}: Props = $props();

	// Variables
	const df = new DateFormatter("en-US", { dateStyle });

	let calendarValue = $state<DateValue | undefined>();

	// Functions
	function handleValueChange(date: DateValue | undefined) {
		const formattedDate = date ? format(df.format(date.toDate(getLocalTimeZone())), "yyyy-MM-dd") : null;
		onDateSelected?.(formattedDate);
	}

	$effect(() => {
		if (calendarValue) {
			value = new Date(calendarValue.toString());
		} else if (value) {
			value = value;
			const dateValue = new Date(value);
			calendarValue = new CalendarDate(dateValue.getFullYear(), dateValue.getMonth() + 1, dateValue.getDate());
		} else {
			value = null;
			calendarValue = undefined;
		}
	});
</script>

<FormField id={name} class={cn("", className)}>
	{#if slotLabel}
		{@render slotLabel()}
	{:else}
		<FormFieldLabel {required}>{label}</FormFieldLabel>
	{/if}

	<Popover>
		<PopoverTrigger>
			{#snippet child({ props })}
				<Button
					variant="outline"
					class={cn("w-full justify-start text-left font-normal", {
						"text-muted-foreground": !value,
					})}
					{disabled}
					{...props}
				>
					<CalendarIcon class="size-4" />
					{value ? format(value, placeholderDateFormat || "MMM dd, yyyy") : placeholder}
				</Button>
			{/snippet}
		</PopoverTrigger>

		<PopoverContent class="w-auto p-0">
			<Calendar type="single" initialFocus onValueChange={handleValueChange} bind:value={calendarValue} />
		</PopoverContent>
	</Popover>

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
