<script lang="ts">
  import { today as localToday } from "@/utils/date";
  import { onMount, untrack } from "svelte";
  import { ChevronLeftIcon, ChevronRightIcon, ArrowLeftIcon } from "@lucide/svelte";

  import { Button } from "@/components/ui/button";
  import { Badge } from "@/components/ui/badge";
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
  import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
  import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import MetricCard from "@/components/app/cards/metric-card.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import { DashboardManager } from "@/components/app/projects/dashboard/DashboardManager.svelte";
  import DatasetSelector from "@/components/app/projects/dashboard/DatasetSelector.svelte";
  import DatasetProgressTable from "@/components/app/projects/dashboard/datasourceTable/DatasetProgressTable.svelte";
  import OpenEntriesTable from "@/components/app/projects/dashboard/datasourceTable/OpenEntriesTable.svelte";
  import CompletionHistoryChart from "@/components/app/projects/dashboard/CompletionHistoryChart.svelte";
  import StatusStack from "@/components/app/projects/dashboard/StatusStack.svelte";
  import DeliveryBadge from "@/components/app/projects/dashboard/DeliveryBadge.svelte";
  import {
    deliveryDate,
    deliveryStatus,
    datasetDeliveryDate,
  } from "@/components/app/projects/dashboard/DashboardStatus";
  import Text from "@/components/ui/text/Text.svelte";
  import DataDisplay from "@/components/app/texts/data-display.svelte";

  import type { Interval } from "@/components/app/projects/dashboard/DashboardHistory";

  // Props
  let { projectId }: { projectId: string } = $props();

  // Variables
  const uid = $props.id();
  const manager = untrack(() => new DashboardManager(projectId));
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
  const scope = $derived(detail?.id ?? (manager.ids.join(",") || "all"));

  let notice = $state("");
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
  <section
    class="min-w-0 space-y-6 pb-6 [&_[id=datasource-table-paginator-container]]:gap-3 [&_[id=datasource-table-paginator-container]]:px-6 [&_[id=datasource-table-paginator-container]]:py-2"
  >
    {#if manager.denied}
      <ResponseBlock title="Dashboard data unavailable" description={manager.error}>
        {#snippet actions()}<Button onclick={() => void manager.refresh()}>Try again</Button>{/snippet}
      </ResponseBlock>
    {:else}
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex max-w-full min-w-0 items-center gap-3">
          <span class="text-muted-foreground text-xs">Datasets</span>
          <DatasetSelector {projectId} ids={manager.ids} select={(ids) => void manager.select(ids)} />

          {#if manager.ids.length !== 1 && manager.poolCount > 1}
            <div
              role="toolbar"
              tabindex="0"
              aria-label="Dataset view"
              class="bg-background inline-flex h-8 max-w-72 min-w-0 shrink-0 items-center rounded-md border shadow-xs"
              onkeydown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  void manager.step(event.key === "ArrowLeft" ? -1 : 1);
                }
              }}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                class="size-7 rounded-none rounded-l-md"
                aria-label="Previous dataset"
                disabled={manager.loading}
                onclick={() => void manager.step(-1)}
              >
                <ChevronLeftIcon class="size-3" />
              </Button>
              <Tooltip>
                <TooltipTrigger class="min-w-0 flex-1 truncate px-2 text-xs font-medium">
                  {detail?.name ?? (manager.ids.length ? "Selected datasets" : "All datasets")}
                </TooltipTrigger>
                <TooltipContent class="max-w-xs [overflow-wrap:anywhere]">
                  {detail?.name ?? (manager.ids.length ? "Selected datasets" : "All datasets")}
                </TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon-sm"
                class="size-7 rounded-none rounded-r-md"
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

      {#if detail}<div class="space-y-3">
          {#if manager.ids.length !== 1}
            <Button variant="ghost" size="sm" class="px-0" onclick={() => void manager.focus(null)}
              ><ArrowLeftIcon />{manager.ids.length ? "Back to selected datasets" : "Back to all datasets"}</Button
            >
          {/if}
          <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h2 class="min-w-0 flex-1 text-xl font-semibold [overflow-wrap:anywhere]">
              {detail.name}
            </h2>
            <div class="flex shrink-0 items-center justify-end gap-3 self-end sm:ml-6 sm:self-start">
              <Badge variant="secondary" class="capitalize">
                {detail.modality}
              </Badge>
              {#if deliveryCounts}<DeliveryBadge
                  date={datasetDeliveryDate(detail)}
                  counts={deliveryCounts}
                />{:else}<Badge variant="secondary">Status unavailable</Badge>{/if}
            </div>
          </div>

          <DataDisplay label="Delivery date">
            {#snippet slotValue()}
              <DateText
                datetime={deliveryDate(datasetDeliveryDate(detail))}
                datetimeFormat="MMM dd, yyyy"
                size="sm"
                weight="light"
                showTooltip
              />
            {/snippet}
          </DataDisplay>
        </div>
      {:else if manager.ids.length}
        <p class="text-muted-foreground text-xs">
          Filtered overview · {manager.ids.length} datasets selected
        </p>
      {/if}

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total entries"
          value={counts ? counts.total.toLocaleString() : (detail?.entries_total_count?.toLocaleString() ?? "—")}
        />

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
            <Text size="h2" weight="semibold"
              >{deliveryCounts ? (deliveryCounts.total - deliveryCounts.completed).toLocaleString() : "—"}</Text
            >
            <Text class="text-muted-foreground" size="sm">
              {counts
                ? `${(counts.reviewing + counts.pendingReview).toLocaleString()} in review · ${(counts.annotating + counts.pendingAnnotation).toLocaleString()} in annotation${counts.residual ? ` · ${counts.residual} outside active workflow` : ""}`
                : "Workflow breakdown unavailable"}
            </Text>
          {/snippet}
        </MetricCard>

        <MetricCard title={detail ? "Delivery" : "Datasets needing attention"}>
          {#snippet slotValue()}
            <Text size="h2" weight="semibold"
              >{detail
                ? deliveryCounts
                  ? deliveryStatus(datasetDeliveryDate(detail), deliveryCounts, $localToday).label
                  : "Unavailable"
                : (manager.attention?.toLocaleString() ?? "—")}</Text
            >
            <Text class="text-muted-foreground" size="sm">
              {detail
                ? datasetDeliveryDate(detail)
                  ? "Based on delivery date and current completion"
                  : "No due date set"
                : manager.attention === null
                  ? "Overdue count unavailable for this scope"
                  : "Overdue datasets that are not completed"}
            </Text>
          {/snippet}
        </MetricCard>
      </div>
      <Card
        ><CardHeader
          ><CardTitle>Entries by status</CardTitle><CardDescription
            >Current workflow distribution{counts
              ? ` · ${counts.total.toLocaleString()} entries`
              : " · exact counts unavailable"}</CardDescription
          ></CardHeader
        ><CardContent
          >{#if counts}<StatusStack {counts} />{:else}<ResponseBlock
              size="sm"
              title={manager.loading ? "Loading workflow counts" : "Workflow counts unavailable"}
              description={manager.error || "No counts have been replaced with zero."}
            />{/if}</CardContent
        ></Card
      >
      <CompletionHistoryChart
        range={manager.trendRange}
        bind:interval
        trend={manager.trend}
        onApply={(range) => manager.applyTrendRange(range)}
        onRetry={() => manager.retryTrend()}
      />
      {#if !detail}<Card
          ><CardHeader><CardTitle>Progress by dataset</CardTitle></CardHeader><CardContent class="px-0"
            >{#key `${manager.version}-${manager.tableEpoch}`}<DatasetProgressTable
                stateKey={"dashboard-datasets-" + uid + "-" + manager.tableEpoch}
                sources={manager.sources}
                ids={manager.ids}
                choose={(record, page) => void manager.focus(record, page)}
              />{/key}</CardContent
          ></Card
        >{/if}
      <Card
        ><CardHeader class="flex flex-wrap justify-between gap-3 sm:flex-row"
          ><div class="space-y-1.5">
            <CardTitle>Open entries</CardTitle>
          </div>
          {#if detail}
            <Button
              variant="link"
              size="sm"
              onclick={() => location.assign(`/projects/${projectId}/datasets/${detail.id}/entries`)}
              >All entries</Button
            >
          {:else}<Button
              variant="link"
              size="sm"
              onclick={() =>
                (notice =
                  "A combined Dataset Entries view is not connected yet. Select one Dataset to open its Entries page.")}
              >All entries</Button
            >
          {/if}
        </CardHeader>
        <CardContent class="px-0"
          >{#key `${!!detail}-${scope}-${manager.version}-${manager.tableEpoch}`}<OpenEntriesTable
              stateKey={"dashboard-open-entries-" + uid + "-" + manager.tableEpoch}
              sources={manager.sources}
              ids={detail ? [detail.id] : manager.ids}
              combined={!detail}
            />{/key}</CardContent
        ></Card
      >

      {#if notice}<Alert
          ><AlertTitle>Dashboard information</AlertTitle><AlertDescription
            >{notice}<Button variant="ghost" size="sm" onclick={() => (notice = "")}>Dismiss</Button></AlertDescription
          ></Alert
        >{/if}
    {/if}
  </section>
</TooltipProvider>
