<script lang="ts">
  import {
    CalendarDate,
    DateFormatter,
    getLocalTimeZone,
    type DateValue,
  } from "@internationalized/date";
  import { CalendarIcon } from "@lucide/svelte";
  import { format } from "date-fns";

  import FormFieldErrors from "$lib/components/ui/Forms/FormFieldErrors.svelte";
  import FormFieldInfo from "$lib/components/ui/Forms/FormFieldInfo.svelte";
  import FormFieldLabel from "$lib/components/ui/Forms/FormFieldLabel.svelte";
  import FormField from "$lib/components/ui/Forms/FormField.svelte";
  import Button from "$lib/components/ui/Button/Button.svelte";
  import Calendar from "$lib/components/ui/calendar/calendar.svelte";
  import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from "$lib/components/ui/Popover";

  import { cn } from "$lib/utils";

  import type { DateFieldBaseProps } from "$lib/components/ui/Forms/fields/picker/date-field.types";

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
    const formattedDate = date
      ? format(df.format(date.toDate(getLocalTimeZone())), "yyyy-MM-dd")
      : null;
    onDateSelected?.(formattedDate);
  }

  $effect(() => {
    if (calendarValue) {
      value = new Date(calendarValue.toString());
    } else if (value) {
      value = value;
      const dateValue = new Date(value);
      calendarValue = new CalendarDate(
        dateValue.getFullYear(),
        dateValue.getMonth() + 1,
        dateValue.getDate(),
      );
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
          <CalendarIcon class="size-4"></CalendarIcon>
          {value
            ? format(value, placeholderDateFormat || "MMM dd, yyyy")
            : placeholder}
        </Button>
      {/snippet}
    </PopoverTrigger>

    <PopoverContent class="w-auto p-0">
      <Calendar
        type="single"
        initialFocus
        onValueChange={handleValueChange}
        bind:value={calendarValue}
      ></Calendar>
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
