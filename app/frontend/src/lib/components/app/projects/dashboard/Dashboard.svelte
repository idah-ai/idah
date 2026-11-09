<script lang="ts">
  import { today as localToday } from "@/utils/date";
  import { onMount, untrack } from "svelte";
  import { ChevronLeftIcon, ChevronRightIcon } from "@lucide/svelte";

  import { Button } from "@/components/ui/button";
  import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
  import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
  import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import MetricCard from "@/components/app/cards/metric-card.svelte";
  import { getTablePreferences } from "@/components/app/datasource-table/datasource-table.stores.svelte";
  import { DashboardManager } from "@/components/app/projects/dashboard/DashboardManager.svelte";
  import DatasetSelector from "@/components/app/projects/dashboard/DatasetSelector.svelte";
  import DatasetProgressTable from "@/components/app/projects/dashboard/table/DatasetProgressTable.svelte";
  import OpenEntriesTable from "@/components/app/projects/dashboard/table/OpenEntriesTable.svelte";
  import CompletionHistoryChart from "@/components/app/projects/dashboard/CompletionHistoryChart.svelte";
  import StatusStack from "@/components/app/projects/dashboard/StatusStack.svelte";
  import { deliveryStatus, datasetDeliveryDate } from "@/components/app/projects/dashboard/DashboardStatus";
  import Text from "@/components/ui/text/Text.svelte";
  import DataDisplay from "@/components/app/texts/data-display.svelte";

  import type { Interval } from "@/components/app/projects/dashboard/DashboardHistory";
  import { format } from "date-fns";
  import { showToast } from "@/components/ui/toast/index.svelte";

  // Props
  let { projectId }: { projectId: string } = $props();

  // Variables
  const uid = $props.id();
  const datasetPreferences = getTablePreferences("dashboard-datasets-" + uid);
  const entryPreferences = getTablePreferences("dashboard-progress-by-entry-" + uid);
  const manager = untrack(
    () =>
      new DashboardManager(projectId, () => {
        for (const preferences of [datasetPreferences, entryPreferences]) {
          preferences.update((prefs) => ({ ...prefs, pagination: { ...prefs.pagination, page: 1 } }));
        }
      }),
  );
  const counts = $derived(manager.summary);
  const detail = $derived(manager.focused);
  const progress = $derived(
    counts?.total
      ? Math.round((counts.completed / counts.total) * 100)
      : counts
        ? 0
        : detail && Number.isFinite(detail.progress)
          ? Math.round(detail.progress * 100)
          : null,
  );
  const deliveryCounts = $derived(
    counts ?? (detail ? { total: detail.entries_total_count, completed: detail.entries_completed_count } : null),
  );
  const datasetCaption = $derived.by((): string => {
    if (detail) return "in this dataset";
    if (manager.loading || manager.poolCount === null)
      return manager.ids.length ? "across selected datasets" : "across all datasets";
    if (!manager.ids.length || manager.poolCount === manager.projectDatasetCount)
      return manager.projectDatasetCount === null
        ? "across all datasets"
        : `across ${manager.projectDatasetCount} datasets`;
    if (manager.projectDatasetCount === null || manager.projectDatasetCount < manager.poolCount)
      return `across ${manager.poolCount} selected datasets`;
    return `across ${manager.poolCount} of ${manager.projectDatasetCount} datasets`;
  });
  const scope = $derived(detail?.id ?? (manager.ids.join(",") || "all"));

  let interval: Interval = $state("Day");

  // Initialize
  onMount(() => {
    const unsubscribe = localToday.subscribe((day) => {
      void manager.updateReportingDay(day);
    });
    void manager.select([]);
    return () => {
      unsubscribe();
      manager.dispose();
    };
  });
</script>

<TooltipProvider>
  <section class="min-w-0 space-y-6 pb-6 [&_[id=datasource-table-paginator-container]]:gap-3">
    {#if manager.denied}
      <ResponseBlock title="Dashboard data unavailable" description={manager.error}>
        {#snippet actions()}<Button onclick={() => void manager.refresh()}>Try again</Button>{/snippet}
      </ResponseBlock>
    {:else}
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex max-w-full min-w-0 flex-wrap items-center gap-3">
          <span class="text-muted-foreground text-xs">Datasets</span>
          <DatasetSelector {projectId} ids={manager.ids} select={(ids) => void manager.select(ids)} />

          {#if manager.ids.length !== 1 && (manager.poolCount ?? 0) > 1}
            <div
              role="toolbar"
              tabindex="0"
              aria-label="Dataset view"
              class="bg-muted inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-lg p-1"
              onkeydown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  void manager.step(event.key === "ArrowLeft" ? -1 : 1);
                }
              }}
            >
              <Button
                variant="ghost"
                class={!detail
                  ? "bg-background text-primary hover:bg-background font-semibold shadow-sm"
                  : "text-muted-foreground"}
                size="sm"
                aria-pressed={!detail}
                disabled={manager.loading}
                onclick={() => {
                  if (detail) void manager.focus(null);
                }}>All datasets ({manager.poolCount}{manager.poolMore ? "+" : ""})</Button
              >
              <span class="bg-border mx-1 h-4 w-px shrink-0" aria-hidden="true"></span>
              <Button
                variant="ghost"
                size="icon-sm"
                class="size-7"
                aria-label="Previous dataset"
                disabled={manager.loading}
                onclick={() => void manager.step(-1)}
              >
                <ChevronLeftIcon class="size-3" />
              </Button>
              <Tooltip>
                <TooltipTrigger
                  class={`h-8 max-w-56 min-w-0 flex-1 truncate rounded-md px-3 text-xs ${detail ? "bg-background text-primary font-semibold shadow-sm" : "text-muted-foreground"}`}
                >
                  {detail?.name ?? "Select a dataset"}
                </TooltipTrigger>
                <TooltipContent class="max-w-xs [overflow-wrap:anywhere]">
                  {detail?.name ?? "Select a dataset"}
                </TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon-sm"
                class="size-7"
                aria-label="Next dataset"
                disabled={manager.loading}
                onclick={() => void manager.step(1)}
              >
                <ChevronRightIcon class="size-3" />
              </Button>
            </div>
          {/if}
        </div>
      </div>

      {#if manager.error}
        <Alert variant="destructive">
          <AlertTitle>Dashboard could not refresh</AlertTitle><AlertDescription>{manager.error}</AlertDescription>
        </Alert>
      {/if}

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total entries">
          {#snippet slotValue()}
            <Text size="h2" weight="semibold"
              >{counts ? counts.total.toLocaleString() : (detail?.entries_total_count?.toLocaleString() ?? "—")}</Text
            >
            <Text size="sm" class="text-muted-foreground">{datasetCaption}</Text>
          {/snippet}
        </MetricCard>

        <MetricCard
          title={detail ? "Dataset progress" : manager.ids.length ? "Progress of selection" : "Overall progress"}
        >
          {#snippet slotValue()}
            <Text size="h2" weight="semibold">{progress === null ? "—" : `${progress}%`}</Text>

            <div class="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
              <div class="bg-primary h-full" style={`width:${progress ?? 0}%`}></div>
            </div>

            <Text class="text-muted-foreground" size="sm">
              {counts
                ? `${counts.completed.toLocaleString()} of ${counts.total.toLocaleString()} completed`
                : detail
                  ? `${detail.entries_completed_count.toLocaleString()} of ${detail.entries_total_count.toLocaleString()} completed`
                  : "Exact workflow counts unavailable"}
            </Text>
          {/snippet}
        </MetricCard>

        <MetricCard title="Open entries">
          {#snippet slotValue()}
            <Text size="h2" weight="semibold">
              {deliveryCounts ? (deliveryCounts.total - deliveryCounts.completed).toLocaleString() : "—"}
            </Text>
            <Text class="text-muted-foreground" size="sm">
              {counts
                ? `${(counts.reviewing + counts.pendingReview).toLocaleString()} in review · ${(counts.annotating + counts.pendingAnnotation).toLocaleString()} in annotation${counts.residual ? ` · ${counts.residual} outside active workflow` : ""}`
                : "Workflow breakdown unavailable"}
            </Text>
          {/snippet}
        </MetricCard>

        <MetricCard title={detail ? "Delivery" : "Datasets needing attention"}>
          {#snippet slotValue()}
            <Text size="h2" weight="semibold">
              {detail
                ? deliveryCounts
                  ? deliveryStatus(datasetDeliveryDate(detail), deliveryCounts, $localToday).label
                  : "Unavailable"
                : (manager.attention?.toLocaleString() ?? "—")}
            </Text>

            {#if detail?.delivery_date}
              <DataDisplay label="Delivery date" value={format(detail?.delivery_date, "MMM dd, yyyy")} />
            {:else}
              <Text class="text-muted-foreground" size="sm">
                {manager.attention === null
                  ? "Overdue count unavailable for this scope"
                  : "Overdue datasets that are not completed"}
              </Text>
            {/if}
          {/snippet}
        </MetricCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entries by status</CardTitle>
        </CardHeader>

        <CardContent>
          {#if counts}<StatusStack {counts} />{:else}<ResponseBlock
              size="sm"
              title={manager.loading ? "Loading workflow counts" : "Workflow counts unavailable"}
              description={manager.error || "No counts have been replaced with zero."}
            />{/if}
        </CardContent>
      </Card>
      <CompletionHistoryChart
        range={manager.trendRange}
        bind:interval
        trend={manager.trend}
        onApply={(range) => manager.applyTrendRange(range)}
        onRetry={() => manager.retryTrend()}
      />
      {#if !detail}<Card>
          <CardHeader><CardTitle>Progress by dataset</CardTitle></CardHeader><CardContent class="px-0">
            {#key `${manager.version}-${manager.tableEpoch}`}<DatasetProgressTable
                preferences={datasetPreferences}
                sources={manager.sources}
                ids={manager.ids}
                choose={(record, page) => void manager.focus(record, page)}
              />{/key}
          </CardContent>
        </Card>{/if}
      <Card>
        <CardHeader class="flex flex-wrap justify-between gap-3 sm:flex-row">
          <div class="space-y-1.5">
            <CardTitle>Progress by entry</CardTitle>
          </div>
          {#if detail}
            <Button
              variant="link"
              size="sm"
              onclick={() => location.assign(`/projects/${projectId}/datasets/${detail.id}/entries`)}
            >
              All entries
            </Button>
          {:else}<Button
              variant="link"
              size="sm"
              onclick={() => {
                showToast.error({
                  title: "Unable to open all enties",
                  description:
                    "A combined Dataset Entries view is not connected yet. Select one Dataset to open its Entries page.",
                });
              }}
            >
              All entries
            </Button>
          {/if}
        </CardHeader>
        <CardContent class="px-0">
          {#key `${!!detail}-${scope}-${manager.version}-${manager.tableEpoch}`}<OpenEntriesTable
              preferences={entryPreferences}
              {counts}
              sources={manager.sources}
              ids={detail ? [detail.id] : manager.ids}
              combined={!detail && manager.ids.length !== 1 && (manager.poolCount === null || manager.poolCount > 1)}
            />{/key}
        </CardContent>
      </Card>
    {/if}
  </section>
</TooltipProvider>
