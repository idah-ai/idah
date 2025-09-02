<script lang="ts">
	import Button from "@/components/ui/button/button.svelte";
	import {
		Command,
		CommandEmpty,
		CommandGroup,
		CommandInput,
		CommandItem,
		CommandList,
		CommandSeparator,
	} from "@/components/ui/command";
	import FormField from "@/components/app/forms/form-field.svelte";
	import FormFieldErrors from "@/components/app/forms/form-field-errors.svelte";
	import FormFieldInfo from "@/components/app/forms/form-field-info.svelte";
	import FormFieldLabel from "@/components/app/forms/form-field-label.svelte";
	import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

	import { cn } from "@/utils";
	import { CheckIcon, ChevronsUpDownIcon, RotateCcwIcon } from "@lucide/svelte";

	import type { SelectFieldBaseProps } from "@/components/app/forms/form-field.types";
	import type { LabelValue } from "@/components/app/ComponentApp.types";

	// Props
	interface Props extends SelectFieldBaseProps {
		value: string | number | null;
	}
	let {
		choices,
		value = $bindable(null),
		name,
		label,
		placeholder = "Select an option",
		searchable = false,
		searchPlaceholder = "Search an option",
		clearable = false,
		disabled = false,
		required = false,
		info,
		errors,
		class: className,
		slotLabel,
		slotInfo,
		slotErrors,
	}: Props = $props();

	// Variables
	let open: boolean = $state(false);
	let selectedValue = $derived(choices.find((choice) => choice.value == value));

	// Functions
	function select(choice: LabelValue<string>): void {
		value = choice.value;
		open = false;
	}

	function clearValue(): void {
		value = null;
	}
</script>

<FormField id={name} class={cn("", className)}>
	{#if slotLabel}
		{@render slotLabel()}
	{:else}
		<FormFieldLabel {required}>{label}</FormFieldLabel>
	{/if}

	<Popover bind:open>
		<PopoverTrigger>
			{#snippet child({ props })}
				<Button variant="outline" class="justify-between" role="combobox" aria-expanded={open} {...props}>
					{#if selectedValue}
						{selectedValue.label}
					{:else}
						<span class="text-muted-foreground">{placeholder}</span>
					{/if}

					<ChevronsUpDownIcon class="ml-auto size-4 shrink-0 opacity-50" />
				</Button>
			{/snippet}
		</PopoverTrigger>

		<PopoverContent align="start" class="p-0">
			<Command>
				{#if searchable}
					<CommandInput placeholder={searchPlaceholder} />
				{/if}

				<CommandList>
					<CommandEmpty>No option found.</CommandEmpty>
					<CommandGroup>
						{#each choices as choice (choice.value)}
							<CommandItem value={choice.value} onSelect={() => select(choice)}>
								<CheckIcon
									class={cn("mr-2 size-4", {
										"opacity-0": choice.value !== value,
									})}
								/>
								{choice.label}
							</CommandItem>
						{/each}
					</CommandGroup>

					{#if clearable}
						<CommandSeparator />
						<CommandGroup>
							<CommandItem onSelect={clearValue}>
								<RotateCcwIcon class="mr-2 size-4" />
								Clear selection
							</CommandItem>
						</CommandGroup>
					{/if}
				</CommandList>
			</Command>
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
