<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";
  import { today, toCalendarDate, startOfWeek, startOfMonth, endOfMonth } from "@internationalized/date";
  import { CalendarIcon } from "@lucide/svelte";

  import { Button } from "@/components/ui/button";
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
  import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
  import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
  import RangeCalendar from "@/components/ui/range-calendar/range-calendar.svelte";
  import {
    rangeDays,
    automaticInterval,
    intervalAllowed as allowed,
    type Interval,
    type DashboardRange,
  } from "@/components/app/projects/dashboard/DashboardHistory";

  import type { CalendarDate } from "@internationalized/date";
  import type { DateRange } from "bits-ui";

  // Props
  let { range = $bindable(), interval = $bindable() }: { range: DashboardRange; interval: Interval } = $props();

  // Variables
  const day = today("Asia/Bangkok"),
    desktop = new MediaQuery("(min-width:768px)");
  const dateLabel = (value: CalendarDate) =>
    value
      .toDate("Asia/Bangkok")
      .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
  let rangeOpen = $state(false),
    draft: DateRange | undefined = $state();
  const days = $derived(rangeDays(range));
  const valid = $derived(
    draft?.start && draft.end && draft.start.compare(draft.end) <= 0 && draft.end.compare(day) <= 0,
  );

  // Functions
  function openRange(open: boolean) {
    rangeOpen = open;
    draft = open ? { start: range.start, end: range.end } : undefined;
  }

  function preset(label: string) {
    let start = day,
      end = day;
    const week = startOfWeek(day, "en-GB");
    if (label === "Last 7 days") start = day.subtract({ days: 6 });
    if (label === "Last 30 days") start = day.subtract({ days: 29 });
    if (label === "Last 90 days") start = day.subtract({ days: 89 });
    if (label === "Last 6 months") start = day.subtract({ months: 6 }).add({ days: 1 });
    if (label === "This week") start = week;
    if (label === "Last week") {
      start = week.subtract({ days: 7 });
      end = week.subtract({ days: 1 });
    }
    if (label === "This month") start = startOfMonth(day);
    if (label === "Last month") {
      start = startOfMonth(day.subtract({ months: 1 }));
      end = endOfMonth(start);
    }
    draft = { start, end };
  }

  function applyRange() {
    if (!valid || !draft?.start || !draft.end) return;
    range = { start: toCalendarDate(draft.start), end: toCalendarDate(draft.end) };
    interval = automaticInterval(rangeDays(range));
    openRange(false);
  }

  function intervalAllowed(value: Interval) {
    return allowed(value, days);
  }
</script>

<Card
  ><CardHeader class="flex flex-wrap items-start justify-between gap-4 md:flex-row"
    ><div class="space-y-1.5">
      <CardTitle>Completed entries</CardTitle><CardDescription
        >Completion history is not recorded for this project.</CardDescription
      >
    </div>
    <Popover open={rangeOpen} onOpenChange={openRange}
      ><PopoverTrigger
        >{#snippet child({ props })}<Button {...props} variant="outline" class="font-normal"
            ><CalendarIcon />{dateLabel(range.start)} – {dateLabel(range.end)}</Button
          >{/snippet}</PopoverTrigger
      ><PopoverContent align="end" class="w-auto max-w-[calc(100vw-2rem)] p-0"
        ><div class="border-b px-4 py-3">
          <p class="text-sm font-medium">Completion date range</p>
          <p class="text-muted-foreground text-xs">Asia/Bangkok</p>
        </div>
        <div class="flex flex-col md:flex-row">
          <div class="flex max-w-lg flex-wrap gap-1 border-b p-2 md:w-36 md:flex-col md:border-r md:border-b-0">
            {#each ["Today", "Last 7 days", "Last 30 days", "Last 90 days", "Last 6 months", "This week", "Last week", "This month", "Last month"] as label (label)}<Button
                variant="ghost"
                size="sm"
                class="justify-start font-normal"
                onclick={() => preset(label)}>{label}</Button
              >{/each}
          </div>
          <RangeCalendar
            bind:value={draft}
            maxValue={day}
            numberOfMonths={desktop.current ? 2 : 1}
            locale="en-GB"
            weekStartsOn={1}
          />
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t p-3">
          <span class="text-muted-foreground text-xs"
            >{draft?.start ? dateLabel(toCalendarDate(draft.start)) : "Start date"} – {draft?.end
              ? dateLabel(toCalendarDate(draft.end))
              : "End date"}</span
          >
          <div class="flex gap-2">
            <Button variant="outline" size="sm" onclick={() => openRange(false)}>Cancel</Button><Button
              size="sm"
              disabled={!valid}
              onclick={applyRange}>Apply</Button
            >
          </div>
        </div></PopoverContent
      ></Popover
    >
  </CardHeader><CardContent
    ><div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p>
          <strong class="text-3xl font-semibold tabular-nums">—</strong><span class="text-muted-foreground ml-2 text-xs"
            >completed in selected range</span
          >
        </p>
        <p class="text-muted-foreground mt-1 text-xs">Previous-period comparison unavailable</p>
      </div>
      <div class="flex gap-1">
        {#each ["Day", "Week", "Month"] as value (value)}{@const item = value as Interval}<Tooltip
            ><TooltipTrigger
              >{#snippet child({ props })}<Button
                  {...props}
                  size="sm"
                  variant={interval === item ? "secondary" : "ghost"}
                  aria-pressed={interval === item}
                  aria-disabled={!intervalAllowed(item)}
                  class="aria-disabled:pointer-events-auto"
                  onclick={() => {
                    if (intervalAllowed(item)) interval = item;
                  }}>{item}</Button
                >{/snippet}</TooltipTrigger
            ><TooltipContent
              >{item === "Day"
                ? "Day is available for ranges up to 92 days"
                : item === "Month"
                  ? "Month is available for ranges of at least 60 days"
                  : "Group by calendar week"}</TooltipContent
            ></Tooltip
          >{/each}
      </div>
    </div>
    <div
      class="text-muted-foreground flex h-64 items-center justify-center rounded-md border border-dashed p-6 text-center text-sm"
    >
      Historical completion dates are unavailable. Current totals cannot be shown as a completion timeline.
    </div>
    <p class="text-muted-foreground mt-4 text-xs">
      Grouping adjusts to your range. Date range does not change current progress.
    </p></CardContent
  ></Card
>
