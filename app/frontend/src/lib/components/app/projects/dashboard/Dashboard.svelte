<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { getLocalTimeZone, today } from "@internationalized/date";
  import { ChevronLeftIcon, ChevronRightIcon, RefreshCwIcon, ArrowLeftIcon } from "@lucide/svelte";

  import { Button } from "@/components/ui/button";
  import { Badge } from "@/components/ui/badge";
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
  import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
  import { TooltipProvider } from "@/components/ui/tooltip";
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

  import { type DashboardRange, type Interval } from "@/components/app/projects/dashboard/DashboardHistory";

  // Props
  let { projectId }: { projectId: string } = $props();

  // Variables
  const uid = $props.id();
  const manager = untrack(() => new DashboardManager(projectId));
  const day = today(getLocalTimeZone());
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
  let range: DashboardRange = $state({ start: day.subtract({ days: 6 }), end: day });
  let interval: Interval = $state("Day");

  // Initialize
  onMount(() => {
    void manager.select([]);
    return () => manager.dispose();
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
          <span class="text-muted-foreground text-xs">Datasets</span><DatasetSelector
            sources={manager.sources}
            ids={manager.ids}
            select={(ids) => void manager.select(ids)}
          />
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <span class="text-muted-foreground text-xs">
            {manager.updated
              ? `Current metrics updated ${manager.updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Current metrics not loaded"}
          </span>
          <Button variant="outline" size="sm" disabled={manager.loading} onclick={() => void manager.refresh()}>
            <RefreshCwIcon class={manager.loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      {#if manager.ids.length !== 1 && manager.poolCount > 1}
        <div
          role="toolbar"
          tabindex="0"
          aria-label="Dataset view"
          class="flex min-w-0 flex-wrap items-center gap-2"
          onkeydown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              void manager.step(event.key === "ArrowLeft" ? -1 : 1);
            }
          }}
        >
          <Button variant={!detail ? "secondary" : "outline"} onclick={() => void manager.focus(null)}>
            {manager.ids.length
              ? `Selected datasets (${manager.ids.length})`
              : `All datasets (${manager.poolCount}${manager.poolMore ? "+" : ""})`}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous dataset"
            disabled={manager.navigationPage === null || (!detail && manager.poolMore)}
            onclick={() => void manager.step(-1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant={detail ? "secondary" : "outline"}
            class="max-w-80 min-w-0"
            title={detail?.name ?? manager.remembered?.name ?? "View a dataset"}
            onclick={() => {
              if (manager.remembered) void manager.focus(manager.remembered);
              else void manager.step(1);
            }}
          >
            <span class="truncate">
              {detail?.name ?? manager.remembered?.name ?? "View a dataset"}
            </span>
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next dataset"
            disabled={manager.navigationPage === null}
            onclick={() => void manager.step(1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      {/if}

      {#if manager.error}
        <Alert variant="destructive">
          <AlertTitle>Dashboard could not refresh</AlertTitle><AlertDescription>{manager.error}</AlertDescription>
        </Alert>
      {/if}

      {#if detail}<div class="space-y-3">
          {#if manager.ids.length !== 1}
            <Button variant="ghost" size="sm" class="px-0" onclick={() => void manager.focus(null)}
              ><ArrowLeftIcon />Back to all datasets</Button
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

          <div class="text-muted-foreground flex gap-2 text-xs">
            Delivery date:
            {#if datasetDeliveryDate(detail)}
              <DateText datetime={deliveryDate(datasetDeliveryDate(detail))} datetimeFormat="MMM dd, yyyy" size="sm" />
            {:else}No delivery date
            {/if}
          </div>
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
        <Card>
          <CardHeader
            ><CardDescription
              >{detail
                ? "Dataset progress"
                : manager.ids.length
                  ? "Progress of selection"
                  : "Overall progress"}</CardDescription
            >
            <CardTitle class="text-2xl">{progress === null ? "—" : `${progress}%`}</CardTitle>

            <div class="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
              <div class="bg-primary h-full" style={`width:${progress ?? 0}%`}></div>
            </div>

            <CardDescription
              >{counts
                ? `${counts.completed.toLocaleString()} of ${counts.total.toLocaleString()} completed`
                : detail
                  ? `${detail.entries_completed_count.toLocaleString()} of ${detail.entries_total_count.toLocaleString()} completed`
                  : "Exact workflow counts unavailable"}</CardDescription
            ></CardHeader
          >
        </Card>
        <Card
          ><CardHeader
            ><CardDescription>Open entries</CardDescription><CardTitle class="text-2xl"
              >{deliveryCounts ? (deliveryCounts.total - deliveryCounts.completed).toLocaleString() : "—"}</CardTitle
            ><CardDescription
              >{counts
                ? `${(counts.reviewing + counts.pendingReview).toLocaleString()} in review · ${(counts.annotating + counts.pendingAnnotation).toLocaleString()} in annotation${counts.residual ? ` · ${counts.residual} outside active workflow` : ""}`
                : "Workflow breakdown unavailable"}</CardDescription
            ></CardHeader
          ></Card
        >
        <Card
          ><CardHeader
            ><CardDescription>{detail ? "Delivery" : "Datasets needing attention"}</CardDescription><CardTitle
              class={detail ? "text-lg" : "text-2xl"}
              >{detail
                ? deliveryCounts
                  ? deliveryStatus(datasetDeliveryDate(detail), deliveryCounts).label
                  : "Unavailable"
                : (manager.attention?.toLocaleString() ?? "—")}</CardTitle
            ><CardDescription
              >{detail
                ? datasetDeliveryDate(detail)
                  ? "Based on delivery date and current completion"
                  : "No due date set"
                : manager.attention === null
                  ? "Overdue count unavailable for this scope"
                  : "Overdue datasets that are not completed"}</CardDescription
            ></CardHeader
          ></Card
        >
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
      <CompletionHistoryChart bind:range bind:interval />
      {#if !detail}<Card
          ><CardHeader
            ><CardTitle>Progress by dataset</CardTitle><CardDescription
              >Use the Dataset Name column menu to filter rows.</CardDescription
            ></CardHeader
          ><CardContent class="px-0"
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
            <CardTitle>Open entries</CardTitle><CardDescription
              >Open entries · oldest created first. Time in status is not recorded.</CardDescription
            >
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
          >{#key `${scope}-${manager.version}`}<OpenEntriesTable
              sources={manager.sources}
              ids={detail ? [detail.id] : manager.ids}
              combined={!detail}
            />{/key}</CardContent
        ></Card
      >
      <p class="text-muted-foreground text-xs">Reporting timezone: Asia/Bangkok.</p>

      {#if notice}<Alert
          ><AlertTitle>Dashboard information</AlertTitle><AlertDescription
            >{notice}<Button variant="ghost" size="sm" onclick={() => (notice = "")}>Dismiss</Button></AlertDescription
          ></Alert
        >{/if}
    {/if}
  </section>
</TooltipProvider>
