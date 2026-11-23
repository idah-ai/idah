<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";
  import { parseDate } from "@internationalized/date";
  import { CalendarIcon } from "@lucide/svelte";
  import { format, isValid as isValidDate, parseISO } from "date-fns";
  import type { DateRange } from "bits-ui";
  import { today } from "@/utils/date";

  import { Button } from "@/components/ui/button";
  import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
  import RangeCalendar from "@/components/ui/range-calendar/range-calendar.svelte";
  import {
    COMPLETION_DATE_PRESETS,
    getPresetValue,
    type DateRangeValue,
    type DateRangePreset,
  } from "@/components/app/forms/fields/picker/constants";
  import Text from "@/components/ui/text/Text.svelte";

  // Props
  interface Props {
    value: DateRangeValue;
    presets?: readonly DateRangePreset[];
    minDate?: string;
    maxDate?: string;
    onApply: (value: DateRangeValue) => void | Promise<void>;
    isValid?: (value: DateRangeValue) => boolean;
    dateFormat?: string;
    title?: string;
    timezone?: string;
  }

  let {
    value,
    presets = COMPLETION_DATE_PRESETS.map((label) => ({ label, getValue: () => getPresetValue(label) })),
    minDate,
    maxDate,
    onApply,
    isValid,
    dateFormat = "d MMM yyyy",
    title = "Date range",
    timezone,
  }: Props = $props();

  // Variables
  const desktop = new MediaQuery("(min-width:768px)");
  let open = $state(false);
  let draft: DateRange | undefined = $state();
  const minimum = $derived(minDate ? parseDate(minDate) : undefined);
  const maximum = $derived(maxDate ? parseDate(maxDate) : undefined);
  const invalidBounds = $derived(!!minimum && !!maximum && minimum.compare(maximum) > 0);
  const presetRanges = $derived.by(() => {
    // Relative preset availability must update when the browser-local day changes.
    void $today;
    return presets.map((preset) => ({ preset, range: resolvePreset(preset) }));
  });
  const valid = $derived(
    !!draft?.start && !!draft.end && validRange({ start: draft.start.toString(), end: draft.end.toString() }),
  );

  // Functions
  function validDate(date: string): boolean {
    const parsed = parseISO(date);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && isValidDate(parsed) && format(parsed, "yyyy-MM-dd") === date;
  }

  function validRange(range: DateRangeValue): boolean {
    return (
      !invalidBounds &&
      [range.start, range.end].every(validDate) &&
      range.start <= range.end &&
      (!minDate || range.start >= minDate) &&
      (!maxDate || range.end <= maxDate) &&
      (!isValid || isValid(range))
    );
  }

  function dateLabel(date: string): string {
    return format(parseISO(date), dateFormat);
  }

  function changeOpen(next: boolean): void {
    open = next;
    draft = next ? { start: parseDate(value.start), end: parseDate(value.end) } : undefined;
  }

  function resolvePreset(preset: DateRangePreset): DateRangeValue | null {
    const requested = preset.getValue();
    if (![requested.start, requested.end].every(validDate) || requested.start > requested.end) return null;
    const range = {
      start: minDate && requested.start < minDate ? minDate : requested.start,
      end: maxDate && requested.end > maxDate ? maxDate : requested.end,
    };
    return validRange(range) ? range : null;
  }

  function selectPreset(preset: DateRangePreset): void {
    const range = resolvePreset(preset);
    if (range) draft = { start: parseDate(range.start), end: parseDate(range.end) };
  }

  function apply(): void {
    if (!draft?.start || !draft.end) return;
    const range = { start: draft.start.toString(), end: draft.end.toString() };
    if (!validRange(range)) return;
    void onApply(range);
    changeOpen(false);
  }
</script>

<Popover {open} onOpenChange={changeOpen}>
  <PopoverTrigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" class="font-normal">
        <CalendarIcon />
        {dateLabel(value.start)} – {dateLabel(value.end)}
      </Button>
    {/snippet}
  </PopoverTrigger>

  <PopoverContent align="end" class="w-auto max-w-[calc(100vw-2rem)] p-0">
    <div class="border-b px-4 py-3">
      <Text size="sm" weight="medium">{title}</Text>
      {#if timezone}
        <Text size="xs" class="text-muted-foreground">{timezone}</Text>
      {/if}
    </div>

    <div class="flex flex-col md:flex-row">
      {#if presets.length}
        <div class="flex max-w-lg flex-wrap gap-1 border-b p-2 md:w-36 md:flex-col md:border-r md:border-b-0">
          {#each presetRanges as { preset, range } (preset.label)}
            <Button
              variant="ghost"
              size="sm"
              class="justify-start font-normal"
              disabled={!range}
              onclick={() => selectPreset(preset)}
            >
              {preset.label}
            </Button>
          {/each}
        </div>
      {/if}
      <RangeCalendar
        bind:value={draft}
        minValue={minimum}
        disabled={invalidBounds}
        maxValue={maximum}
        numberOfMonths={desktop.current ? 2 : 1}
        locale="en-GB"
        weekStartsOn={1}
      />
    </div>
    <div class="flex flex-wrap items-center justify-between gap-3 border-t p-3">
      <span class="text-muted-foreground text-xs"
        >{draft?.start ? dateLabel(draft.start.toString()) : "Start date"} – {draft?.end
          ? dateLabel(draft.end.toString())
          : "End date"}</span
      >
      <div class="flex gap-2">
        <Button variant="outline" size="sm" onclick={() => changeOpen(false)}>Cancel</Button>
        <Button size="sm" disabled={!valid} onclick={apply}>Apply</Button>
      </div>
    </div>
  </PopoverContent>
</Popover>
