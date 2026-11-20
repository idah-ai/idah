<script lang="ts">
  import { RefreshCwIcon } from "@lucide/svelte";

  import * as Card from "$lib/components/ui/card/index";
  import * as Popover from "@/components/ui/popover/index";
  import Button from "@/components/ui/button/button.svelte";
  import Skeleton from "@/components/ui/skeleton/skeleton.svelte";
  import Progress from "@/components/ui/progress/progress.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import {
    getProjectDashboardController,
    PROJECT_DASHBOARD_CONTROLLER_KEY,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";
  import { categoryShare } from "@/components/app/projects/dashboard/category-totals";

  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
  const result = $derived(controller.annotationsByCategory);
  const loading = $derived(!controller.error && (!controller.scopeReady || !result || result.status === "loading"));
  const error = $derived(controller.error || (result?.status === "error" ? result.error : ""));
  const duplicateLabels = $derived(
    new Set(
      result?.rows
        .filter((row, index, rows) =>
          rows.some(
            (other, otherIndex) => index !== otherIndex && other.label === row.label && other.category !== row.category,
          ),
        )
        .map((row) => row.label),
    ),
  );
</script>

<Card.Root class="gap-2">
  <Card.Header>
    <Card.Title>Annotation by category</Card.Title>
    <Card.Action class="flex items-center gap-2">
      <span class="text-muted-foreground max-w-48 truncate text-xs" title={controller.categoryScopeLabel}>
        {controller.categoryScopeLabel}
      </span>

      <Button
        variant="ghost"
        size="sm"
        disabled={loading || controller.denied || controller.loading}
        onclick={() => void controller.refreshCategoryCounts()}
      >
        <RefreshCwIcon />
        Refresh
      </Button>
    </Card.Action>
  </Card.Header>

  <Card.Content>
    {#if error}
      <ResponseBlock size="sm" title="Annotation categories unavailable" description={error}>
        {#snippet actions()}
          <Button
            variant="outline"
            size="sm"
            disabled={controller.denied || controller.loading}
            onclick={() => void controller.refreshCategoryCounts()}>Retry</Button
          >
        {/snippet}
      </ResponseBlock>
    {:else if loading}
      <div class="grid gap-4" role="status" aria-label="Loading annotation categories">
        <Skeleton class="h-8 w-32" />
        {#each Array.from({ length: 5 }) as _, index (index)}
          <Skeleton class="h-6 w-full" />
        {/each}
      </div>
    {:else if result?.status === "ready"}
      <div class="mb-4 flex flex-wrap items-baseline gap-2">
        <span class="text-2xl font-semibold tabular-nums">{result.total?.toLocaleString()}</span>
        <span class="text-muted-foreground text-xs">total annotations {controller.datasetCaption}</span>
      </div>
      {#if !result.rows.length}
        <ResponseBlock
          size="sm"
          title="No annotation categories"
          description="No configured categories or annotations were found in this scope."
        />
      {:else}
        {#if result.total === 0}
          <p class="text-muted-foreground mb-3 text-sm">No annotations yet. Configured categories are shown below.</p>
        {/if}
        <div class="max-h-96 overflow-y-auto pr-1">
          {#each result.rows as row (row.id)}
            {@const share = categoryShare(row.annotation_count, result.total ?? 0)}
            <div
              class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[minmax(8rem,3fr)_minmax(0,7fr)_auto_auto]"
            >
              <div class="col-start-1 row-start-1 min-w-0">
                <Popover.Root>
                  <Popover.Trigger
                    class="max-w-full truncate text-left text-sm font-medium underline decoration-dotted underline-offset-4"
                    aria-label={`${row.label}: show category ID and datasets`}
                  >
                    {row.label}
                  </Popover.Trigger>
                  <Popover.Content align="start" class="max-w-[calc(100vw-2rem)] text-xs">
                    <p class="font-medium break-words">{row.label}</p>
                    <p class="text-muted-foreground mt-1 break-all">ID: {row.category}</p>
                    <p class="mt-3 font-medium">Contributing datasets</p>
                    <ul class="mt-1 max-h-48 space-y-1 overflow-y-auto">
                      {#each row.datasets as dataset (dataset.id)}
                        <li class="break-words">{dataset.name}</li>
                      {/each}
                    </ul>
                  </Popover.Content>
                </Popover.Root>
                {#if row.label_conflict || duplicateLabels.has(row.label)}
                  <p class="text-muted-foreground truncate text-xs" title={row.category}>{row.category}</p>
                {/if}
                {#if row.label_conflict}
                  <p class="text-muted-foreground text-xs">Different labels</p>
                {/if}
                {#if !row.configured}
                  <p class="text-muted-foreground text-xs">Unconfigured</p>
                {/if}
              </div>
              <Progress
                class="col-span-3 col-start-1 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                value={share.value}
                aria-label={`${row.label}: ${row.annotation_count.toLocaleString()} annotations, ${share.label} of total`}
              />
              <span class="col-start-2 row-start-1 text-right text-sm font-medium tabular-nums sm:col-start-3">
                {row.annotation_count.toLocaleString()}
              </span>
              <span
                class="text-muted-foreground col-start-3 row-start-1 min-w-9 text-right text-xs tabular-nums sm:col-start-4"
              >
                {share.label}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </Card.Content>
</Card.Root>
