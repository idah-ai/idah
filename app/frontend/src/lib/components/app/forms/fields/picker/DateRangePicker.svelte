<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";
  import { parseDate } from "@internationalized/date";
  import { CalendarIcon } from "@lucide/svelte";
  import { format, isValid as isValidDate, parseISO } from "date-fns";
  import type { DateRange } from "bits-ui";

  import { Button } from "@/components/ui/button";
  import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
  import RangeCalendar from "@/components/ui/range-calendar/range-calendar.svelte";
  import {
    COMPLETION_DATE_PRESETS,
    getPresetValue,
    type DateRangeValue,
  } from "@/components/app/forms/fields/picker/constants";
  import Text from "@/components/ui/text/Text.svelte";

  // Props
  interface Props {
    value: DateRangeValue;
    maxDate?: string;
    onApply: (value: DateRangeValue) => void | Promise<void>;
    isValid?: (value: DateRangeValue) => boolean;
    dateFormat?: string;
    title?: string;
    timezone?: string;
  }

  let { value, maxDate, onApply, isValid, dateFormat = "d MMM yyyy", title = "Date range", timezone }: Props = $props();

  // Variables
  const desktop = new MediaQuery("(min-width:768px)");
  let open = $state(false);
  let draft: DateRange | undefined = $state();
  const maximum = $derived(maxDate ? parseDate(maxDate) : undefined);
  const valid = $derived(
    !!draft?.start && !!draft.end && validRange({ start: draft.start.toString(), end: draft.end.toString() }),
  );

  // Functions
  function validRange(range: DateRangeValue): boolean {
    return (
      [range.start, range.end].every((date) => {
        const parsed = parseISO(date);
        return /^\d{4}-\d{2}-\d{2}$/.test(date) && isValidDate(parsed) && format(parsed, "yyyy-MM-dd") === date;
      }) &&
      range.start <= range.end &&
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

  function selectPreset(label: (typeof COMPLETION_DATE_PRESETS)[number]): void {
    const range = getPresetValue(label);
    draft = { start: parseDate(range.start), end: parseDate(range.end) };
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
      <div class="flex max-w-lg flex-wrap gap-1 border-b p-2 md:w-36 md:flex-col md:border-r md:border-b-0">
        {#each COMPLETION_DATE_PRESETS as label (label)}
          <Button variant="ghost" size="sm" class="justify-start font-normal" onclick={() => selectPreset(label)}
            >{label}</Button
          >
        {/each}
      </div>
      <RangeCalendar
        bind:value={draft}
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
