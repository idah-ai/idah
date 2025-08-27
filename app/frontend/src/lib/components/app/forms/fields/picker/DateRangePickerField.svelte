<script lang="ts">
	import { format } from "date-fns";

	import Button from "@/components/ui/button/button.svelte";
	import FormField from "@/components/app/forms/FormField.svelte";
	import FormFieldErrors from "@/components/app/forms/FormFieldErrors.svelte";
	import FormFieldInfo from "@/components/app/forms/FormFieldInfo.svelte";
	import FormFieldLabel from "@/components/app/forms/FormFieldLabel.svelte";
	import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
	import RangeCalendar from "@/components/ui/range-calendar/range-calendar.svelte";

	import { cn } from "@/utils";
	import { CalendarIcon } from "@lucide/svelte";
	import { CalendarDate, DateFormatter, type DateValue } from "@internationalized/date";

	import type { DateRange } from "bits-ui";
	import type { DateFieldBaseProps } from "@/components/app/forms/fields/picker/DateField.types";

	// Props
	interface Props extends DateFieldBaseProps {
		from: Date | null;
		to: Date | null;
		onEndValueChanged?: (value: DateValue | undefined) => void;
	}
	let {
		name,
		label,
		disabled = false,
		required = false,
		placeholder = "Select a date range",
		info,
		errors,
		placeholderDateFormat = "MMM dd, yyyy",
		dateStyle = "medium",
		from = $bindable(null),
		to = $bindable(null),
		class: className,
		onEndValueChanged = () => {},
		slotLabel,
		slotInfo,
		slotErrors,
	}: Props = $props();

	// Variables
	const df = new DateFormatter("en-US", { dateStyle });

	let calendarValue = $state<DateRange | undefined>();

	// Effects
	$effect(() => {
		if (calendarValue) {
			from = calendarValue.start ? new Date(calendarValue.start.toString()) : null;
			to = calendarValue.end ? new Date(calendarValue.end.toString()) : null;
		} else if (from && to) {
			const fromDatevalue = new Date(from);
			const toDateValue = new Date(to);
			calendarValue = {
				start: new CalendarDate(fromDatevalue.getFullYear(), fromDatevalue.getMonth() + 1, fromDatevalue.getDate()),
				end: new CalendarDate(toDateValue.getFullYear(), toDateValue.getMonth() + 1, toDateValue.getDate()),
			};
		} else {
			from = null;
			to = null;
			calendarValue = undefined;
		}
	});

	// Functions
	function handleEndValueChange(value: DateValue | undefined) {
		onEndValueChanged?.(value);
	}
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
						"text-muted-foreground": !calendarValue,
					})}
					{disabled}
					{...props}
				>
					<CalendarIcon class="size-4" />

					{#if from && to}
						{format(from, placeholderDateFormat)} - {format(to, placeholderDateFormat)}
					{:else}
						{placeholder}
					{/if}
				</Button>
			{/snippet}
		</PopoverTrigger>

		<PopoverContent class="w-auto p-0">
			<RangeCalendar bind:value={calendarValue} onEndValueChange={handleEndValueChange} />
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
		<FormFieldErrors {errors} />
	{/if}
</FormField>
