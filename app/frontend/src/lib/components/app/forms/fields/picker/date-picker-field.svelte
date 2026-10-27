<script lang="ts">
  import { CalendarDate, DateFormatter, getLocalTimeZone, type DateValue } from "@internationalized/date";
  import { CalendarIcon, XIcon } from "@lucide/svelte";
  import { format } from "date-fns";

  import FormFieldErrors from "@/components/app/forms/form-field-errors.svelte";
  import FormFieldInfo from "@/components/app/forms/form-field-info.svelte";
  import FormFieldLabel from "@/components/app/forms/form-field-label.svelte";
  import FormField from "@/components/app/forms/form-field.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Calendar from "@/components/ui/calendar/calendar.svelte";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

  import { cn } from "@/utils";

  import type { DateFieldBaseProps } from "@/components/app/forms/fields/picker/date-field.types";

  // Props
  interface Props extends DateFieldBaseProps {
    value: Date | null | undefined;
    minDate?: DateValue;
    maxDate?: DateValue;
    clearable?: boolean;
  }
  let {
    name,
    label,
    placeholder = "Select a date",
    placeholderDateFormat,
    dateStyle = "medium",
    required = false,
    disabled = false,
    clearable = false,
    value = $bindable(null),
    minDate,
    maxDate,
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
      value = calendarValue.toDate(getLocalTimeZone());
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
        <div class="relative w-full">
          <Button
            {...props}
            variant="outline"
            class={cn(props.class, "w-full justify-start text-left font-normal", {
              "text-muted-foreground": !value,
              "has-[>svg]:pr-10": clearable && !!value,
            })}
            {disabled}
          >
            <CalendarIcon class="size-4"></CalendarIcon>
            {value ? format(value, placeholderDateFormat || "MMM dd, yyyy") : placeholder}
          </Button>
          {#if clearable && value}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              class="text-muted-foreground absolute top-1/2 right-1 -translate-y-1/2"
              aria-label={`Clear ${label || "date"}`}
              {disabled}
              onclick={() => {
                calendarValue = undefined;
                value = null;
                onDateSelected?.(null);
              }}
            >
              <XIcon class="size-4" />
            </Button>
          {/if}
        </div>
      {/snippet}
    </PopoverTrigger>

    <PopoverContent class="w-auto p-0">
      <Calendar
        type="single"
        minValue={minDate}
        maxValue={maxDate}
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
