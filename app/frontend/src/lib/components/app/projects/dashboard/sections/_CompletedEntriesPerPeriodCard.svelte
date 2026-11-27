<script lang="ts">
  import { Bar, BarChart } from "layerchart";
  import * as Chart from "@/components/ui/chart";
  import { format, isSameMonth, isSameYear, parseISO } from "date-fns";

  import { Button } from "@/components/ui/button";
  import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";
  import { COMPLETION_GROUPINGS } from "@/components/app/projects/dashboard/project-dashboard.constants";
  import DateRangePicker from "@/components/app/forms/fields/picker/DateRangePicker.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import { pluralizeUnit } from "@/utils/unit";

  // Variables
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
  const history = $derived(controller.completionHistory);
  const range = $derived(controller.completionRange);
  const interval = $derived(controller.completionGrouping);
  const zone = $derived(history.zone);
  const buckets = $derived(controller.completionBuckets);
  const maximum = $derived(controller.completionMaximum);
  const chartConfig = {
    count: { label: "Currently completed entries", color: "var(--primary)" },
  } satisfies Chart.ChartConfig;
  const yTicks = $derived(
    [0, Math.floor(maximum / 2), maximum].filter((value, index, values) => values.indexOf(value) === index),
  );
</script>

<Card class="gap-2">
  <CardHeader class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <CardTitle>Completed entries per {interval.toLowerCase()}</CardTitle>

    <div class="flex w-full items-center justify-between gap-2 lg:w-fit lg:justify-end">
      <DateRangePicker
        value={range}
        maxDate={controller.completionToday}
        title="Completion date range"
        timezone={zone}
        isValid={(value) => controller.isCompletionRangeValid(value)}
        onApply={(value) => controller.applyCompletionRange(value)}
      />

      <div class="bg-secondary h-9 items-center rounded-md p-1" aria-label="Completion chart grouping">
        {#each COMPLETION_GROUPINGS as value (value)}
          <Button
            size="sm"
            variant={interval === value ? "outline" : "ghost"}
            aria-pressed={interval === value}
            onclick={() => controller.setCompletionGrouping(value)}>{value}</Button
          >
        {/each}
      </div>
    </div>
  </CardHeader>

  <CardContent>
    {@const rangeStart = parseISO(range.start)}
    {@const rangeEnd = parseISO(range.end)}
    {@const dateFormat = "d MMM yyyy"}
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <Text size="h2" weight="semibold">
          {["ready", "empty"].includes(history.status) ? controller.completionTotal.toLocaleString() : "-"}
        </Text>
        <Text size="xs">
          completed {pluralizeUnit(controller.completionTotal, "entry", "entries")} with completion dates in
          {#if range.start === range.end}
            {format(rangeStart, dateFormat)}
          {:else if isSameMonth(rangeStart, rangeEnd)}
            {format(rangeStart, "d")} – {format(rangeEnd, dateFormat)}
          {:else if isSameYear(rangeStart, rangeEnd)}
            {format(rangeStart, "d MMM")} – {format(rangeEnd, dateFormat)}
          {:else}
            {format(rangeStart, dateFormat)}–{format(rangeEnd, dateFormat)}
          {/if}
        </Text>
      </div>
    </div>
    {#if history.status === "loading" || history.status === "idle"}
      <div
        class="text-muted-foreground flex h-64 items-center justify-center rounded-md border border-dashed text-sm"
        role="status"
      >
        Loading completed entries
      </div>
    {:else if history.status === "ready"}
      <Chart.Container config={chartConfig} class="aspect-auto h-72 w-full min-w-0" role="group">
        <BarChart
          data={buckets}
          x="key"
          y="count"
          xDomain={buckets.map((bucket) => bucket.key)}
          yDomain={[0, maximum]}
          yNice={false}
          bandPadding={0.25}
          series={[{ key: "count", value: "count", label: chartConfig.count.label, color: chartConfig.count.color }]}
          highlight={false}
          rule={false}
          grid={{ x: false, y: true, yTicks }}
          padding={{ left: Math.max(48, maximum.toLocaleString().length * 7 + 12), right: 24, top: 12, bottom: 32 }}
          props={{
            xAxis: {
              format: (key) => buckets.find((bucket) => bucket.key === key)?.axisLabel ?? "",
              tickSpacing: interval === "Week" ? 120 : 64,
              tickOcclusion: true,
            },
            yAxis: { ticks: yTicks, format: (value) => Number(value).toLocaleString() },
          }}
        >
          {#snippet marks({ context })}
            {#each buckets as bucket (bucket.key)}
              <Bar
                data={bucket}
                seriesKey="count"
                y={bucket.count === null ? () => maximum : "count"}
                width={Math.min(48, context.xScale.bandwidth?.() ?? 0)}
                rounded="top"
                radius={3}
                fill={bucket.count === null ? "none" : "var(--primary)"}
                fillOpacity={bucket.current ? 1 : 0.3}
                stroke={bucket.count === null ? "var(--border)" : "none"}
                strokeWidth={bucket.count === null ? 1 : 0}
                style={bucket.count === null ? "stroke-dasharray: 4 3" : undefined}
                tabindex={0}
                role="img"
                aria-current={bucket.current ? "date" : undefined}
                onfocus={() => context.tooltip.show({ data: bucket })}
                onblur={() => context.tooltip.hide()}
              />
            {/each}
          {/snippet}

          {#snippet tooltip({ context })}
            <Chart.Tooltip label={context.tooltip.data?.label} hideIndicator>
              {#snippet formatter({ value })}
                <div class="space-y-1">
                  <Text size="xs">
                    {value === null
                      ? "Not yet verified"
                      : `${Number(value).toLocaleString()} completed ${pluralizeUnit(Number(value), "entry", "entries")}`}
                  </Text>
                  {#if context.tooltip.data?.clipped}<p class="text-muted-foreground">Clipped to selected range</p>{/if}
                </div>
              {/snippet}
            </Chart.Tooltip>
          {/snippet}
        </BarChart>
      </Chart.Container>
    {:else if history.status === "empty"}
      <ResponseBlock
        size="sm"
        title="No completed entries"
        description="No completed entries with completion date in this range."
      />
    {:else}
      <ResponseBlock
        size="sm"
        title="Completed entries unavailable"
        description={history.error || "Completed entries are unavailable."}
      >
        {#snippet actions()}
          <Button
            variant="outline"
            size="sm"
            disabled={controller.denied}
            onclick={() => void controller.retryCompletionHistory()}>Retry</Button
          >
        {/snippet}
      </ResponseBlock>
    {/if}
  </CardContent>
</Card>
