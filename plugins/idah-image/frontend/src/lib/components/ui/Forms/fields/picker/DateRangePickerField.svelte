<script lang="ts">
  import { CalendarDate, type DateValue } from "@internationalized/date";
  import { CalendarIcon } from "@lucide/svelte";
  import type { DateRange } from "bits-ui";
  import { format } from "date-fns";

  import FormFieldErrors from "$lib/components/ui/Forms/FormFieldErrors.svelte";
  import FormFieldInfo from "$lib/components/ui/Forms/FormFieldInfo.svelte";
  import FormFieldLabel from "$lib/components/ui/Forms/FormFieldLabel.svelte";
  import FormField from "$lib/components/ui/Forms/FormField.svelte";
  import Button from "$lib/components/ui/Button/Button.svelte";
  import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from "$lib/components/ui/Popover";
  import RangeCalendar from "$lib/components/ui/RangeCalendar/RangeCalendar.svelte";

  import { cn } from "$lib/utils";

  import type { DateFieldBaseProps } from "$lib/components/ui/Forms/fields/picker/date-field.types";

  // Props
  interface Props extends DateFieldBaseProps {
    from: Date | null;
    to: Date | null;
    onValueChanged?: (value: DateRange) => void;
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
    from = $bindable(null),
    to = $bindable(null),
    class: className,
    onValueChanged = () => {},
    onEndValueChanged = () => {},
    slotLabel,
    slotInfo,
    slotErrors,
  }: Props = $props();

  // Variables
  let calendarValue = $state<DateRange | undefined>();

  // Effects
  $effect(() => {
    if (calendarValue) {
      from = calendarValue.start
        ? new Date(calendarValue.start.toString())
        : null;
      to = calendarValue.end ? new Date(calendarValue.end.toString()) : null;
    } else if (from && to) {
      const fromDatevalue = new Date(from);
      const toDateValue = new Date(to);
      calendarValue = {
        start: new CalendarDate(
          fromDatevalue.getFullYear(),
          fromDatevalue.getMonth() + 1,
          fromDatevalue.getDate(),
        ),
        end: new CalendarDate(
          toDateValue.getFullYear(),
          toDateValue.getMonth() + 1,
          toDateValue.getDate(),
        ),
      };
    } else {
      from = null;
      to = null;
      calendarValue = undefined;
    }
  });

  // Functions
  function handleValueChange(value: DateRange) {
    onValueChanged?.(value);
  }
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
          <CalendarIcon class="size-4"></CalendarIcon>

          {#if from && to}
            {format(from, placeholderDateFormat)} - {format(
              to,
              placeholderDateFormat,
            )}
          {:else}
            {placeholder}
          {/if}
        </Button>
      {/snippet}
    </PopoverTrigger>

    <PopoverContent class="w-auto p-0">
      <RangeCalendar
        bind:value={calendarValue}
        onValueChange={handleValueChange}
        onEndValueChange={handleEndValueChange}
      ></RangeCalendar>
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
