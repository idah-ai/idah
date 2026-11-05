<script lang="ts">
  import { today as localToday } from "@/utils/date";
  import { MediaQuery } from "svelte/reactivity";
  import { fromDate, toCalendarDate, startOfWeek, startOfMonth, endOfMonth } from "@internationalized/date";
  import { CalendarIcon } from "@lucide/svelte";

  import { Button } from "@/components/ui/button";
  import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
  import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
  import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
  import RangeCalendar from "@/components/ui/range-calendar/range-calendar.svelte";
  import {
    rangeDays,
    automaticInterval,
    intervalAllowed as allowed,
    type Interval,
    type DashboardRange,
    completionBuckets,
    viewerTimeZone,
    type CompletionTrend,
  } from "@/components/app/projects/dashboard/DashboardHistory";

  import type { CalendarDate } from "@internationalized/date";
  import type { DateRange } from "bits-ui";

  // Props
  let {
    range = $bindable(),
    interval = $bindable(),
    trend,
    onApply,
    onRetry,
  }: {
    range: DashboardRange;
    interval: Interval;
    trend?: CompletionTrend;
    onApply?: (range: DashboardRange) => void | Promise<void>;
    onRetry?: () => void | Promise<void>;
  } = $props();

  // Variables
  const desktop = new MediaQuery("(min-width:768px)");
  const zone = $derived(trend?.zone ?? viewerTimeZone());
  const day = $derived(toCalendarDate(fromDate($localToday, zone)));
  const complete = $derived(trend?.status === "ready" || trend?.status === "empty");
  const buckets = $derived(completionBuckets(trend?.daily ?? {}, range, interval, complete));
  const maximum = $derived(buckets.reduce((max, bucket) => Math.max(max, bucket.count ?? 0), 1));
  const labelStride = $derived(Math.max(1, Math.ceil(buckets.length / (desktop.current ? 8 : 4))));
  const dateLabel = (value: CalendarDate): string =>
    value.toDate(zone).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: zone });
  let rangeOpen = $state(false),
    draft: DateRange | undefined = $state();
  const days = $derived(rangeDays(range));
  const valid = $derived(
    draft?.start && draft.end && draft.start.compare(draft.end) <= 0 && draft.end.compare(day) <= 0,
  );

  // Functions
  function openRange(open: boolean): void {
    rangeOpen = open;
    draft = open ? { start: range.start, end: range.end } : undefined;
  }

  function preset(label: string): void {
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

  function applyRange(): void {
    if (!valid || !draft?.start || !draft.end) return;
    range = { start: toCalendarDate(draft.start), end: toCalendarDate(draft.end) };
    interval = automaticInterval(rangeDays(range));
    openRange(false);
    void onApply?.(range);
  }

  function intervalAllowed(value: Interval): boolean {
    return allowed(value, days);
  }
</script>

<Card
  ><CardHeader class="flex flex-wrap items-start justify-between gap-4 md:flex-row"
    ><div class="space-y-1.5">
      <CardTitle>Completed entries</CardTitle>
    </div>
    <Popover open={rangeOpen} onOpenChange={openRange}
      ><PopoverTrigger
        >{#snippet child({ props })}<Button {...props} variant="outline" class="font-normal"
            ><CalendarIcon />{dateLabel(range.start)} – {dateLabel(range.end)}</Button
          >{/snippet}</PopoverTrigger
      ><PopoverContent align="end" class="w-auto max-w-[calc(100vw-2rem)] p-0"
        ><div class="border-b px-4 py-3">
          <p class="text-sm font-medium">Completion date range</p>
          <p class="text-muted-foreground text-xs">{zone}</p>
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
          <strong class="text-3xl font-semibold tabular-nums"
            >{trend && ["ready", "empty", "partial"].includes(trend.status)
              ? trend.loaded.toLocaleString()
              : "—"}</strong
          ><span class="text-muted-foreground ml-2 text-xs"
            >recorded completions in selected range{trend?.status === "partial" ? " · incomplete" : ""}</span
          >
        </p>
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
    {#if trend?.status === "loading" || trend?.status === "idle"}
      <div
        class="text-muted-foreground flex h-64 items-center justify-center rounded-md border border-dashed text-sm"
        role="status"
      >
        Loading recorded completions · {trend.loaded.toLocaleString()} rows loaded
      </div>
    {:else if trend?.status === "ready" || trend?.status === "partial"}
      {#if trend.status === "partial"}
        <div class="text-destructive mb-3 flex flex-wrap items-center gap-2 text-sm" role="status">
          {trend.loaded.toLocaleString()} recorded rows loaded — incomplete. {trend.error}
          <Button size="sm" variant="outline" onclick={() => void onRetry?.()}>Retry</Button>
        </div>
      {/if}
      <div class="flex gap-3" role="group" aria-label="Recorded completion trend">
        <div
          class="text-muted-foreground flex h-64 w-12 shrink-0 flex-col justify-between text-right text-xs tabular-nums"
          aria-hidden="true"
        >
          <span>{maximum.toLocaleString()}</span><span>{Math.round(maximum / 2).toLocaleString()}</span><span>0</span>
        </div>
        <div class="min-w-0 flex-1 overflow-x-auto pb-5">
          <div style:min-width={`${buckets.length * 6}px`}>
            <div class="relative flex h-64 items-end gap-1 border-b">
              <div class="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
                <div class="border-t"></div>
                <div class="border-t"></div>
                <div></div>
              </div>
              {#each buckets as bucket (bucket.key)}
                <Tooltip>
                  <TooltipTrigger
                    class="relative flex h-full min-w-0 flex-1 items-end focus-visible:outline-2 focus-visible:outline-offset-2"
                    aria-label={`${dateLabel(bucket.start)} – ${dateLabel(bucket.end)}: ${bucket.count === null ? "not yet verified" : `${bucket.count} recorded completions`}`}
                  >
                    {#if bucket.count === null}
                      <span class="h-full w-full rounded-t border border-dashed" aria-hidden="true"></span>
                    {:else}
                      <span
                        class="bg-primary w-full rounded-t-sm"
                        style:height={`${(bucket.count / maximum) * 100}%`}
                        aria-hidden="true"
                      ></span>
                    {/if}
                  </TooltipTrigger>
                  <TooltipContent>
                    {dateLabel(bucket.start)}{bucket.start.compare(bucket.end) !== 0
                      ? ` – ${dateLabel(bucket.end)}`
                      : ""}
                    · {bucket.count === null
                      ? "Not yet verified"
                      : `${bucket.count.toLocaleString()} recorded completions`}
                    {bucket.clipped ? " · clipped to selected range" : ""}
                  </TooltipContent>
                </Tooltip>
              {/each}
            </div>
            <div class="text-muted-foreground mt-2 flex gap-1 text-xs" aria-hidden="true">
              {#each buckets as bucket, index (bucket.key)}
                <div class="relative min-w-0 flex-1">
                  {#if index % labelStride === 0}
                    <span class="absolute left-0 whitespace-nowrap"
                      >{bucket.start
                        .toDate(zone)
                        .toLocaleDateString(
                          "en-GB",
                          interval === "Month"
                            ? { month: "short", year: "2-digit", timeZone: zone }
                            : { day: "numeric", month: "short", timeZone: zone },
                        )}</span
                    >
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
      <details class="mt-3 text-sm">
        <summary class="cursor-pointer">View completion data</summary>
        <div class="mt-2 max-h-64 overflow-auto">
          <table class="w-full text-left text-xs">
            <caption class="sr-only"
              >Recorded completion buckets in {zone}{trend.status === "partial" ? ", incomplete" : ""}</caption
            >
            <thead><tr><th scope="col">Date range</th><th scope="col">Recorded completions</th></tr></thead>
            <tbody
              >{#each buckets as bucket (bucket.key)}<tr
                  ><th scope="row" class="py-1 font-normal">{dateLabel(bucket.start)} – {dateLabel(bucket.end)}</th><td
                    >{bucket.count ?? "Not yet verified"}</td
                  ></tr
                >{/each}</tbody
            >
          </table>
        </div>
      </details>
    {:else if trend?.status === "empty"}
      <div
        class="text-muted-foreground flex h-64 items-center justify-center rounded-md border border-dashed p-6 text-center text-sm"
        role="status"
      >
        No recorded completions in this range.
      </div>
    {:else}
      <div
        class="text-muted-foreground flex h-64 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center text-sm"
        role="status"
      >
        <p>{trend?.error || "Recorded completions are unavailable."}</p>
        <Button variant="outline" size="sm" onclick={() => void onRetry?.()}>Retry</Button>
      </div>
    {/if}
  </CardContent></Card
>
