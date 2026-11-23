<script lang="ts">
  import {
    ArrowDown01Icon,
    ArrowDown10Icon,
    ArrowDownAZIcon,
    ArrowDownZAIcon,
    ArrowUpDownIcon,
    RefreshCwIcon,
  } from "@lucide/svelte";

  import * as Card from "$lib/components/ui/card/index";
  import * as HoverCard from "@/components/ui/hover-card/index";
  import Button from "@/components/ui/button/button.svelte";
  import Skeleton from "@/components/ui/skeleton/skeleton.svelte";
  import Progress from "@/components/ui/progress/progress.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import {
    getProjectDashboardController,
    PROJECT_DASHBOARD_CONTROLLER_KEY,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";
  import {
    categoryShare,
    sortCategories,
    type CategorySort,
  } from "@/components/app/projects/dashboard/category-totals";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
  const result = $derived(controller.annotationsByCategory);
  const loading = $derived(!controller.error && (!controller.scopeReady || !result || result.status === "loading"));
  const error = $derived(controller.error || (result?.status === "error" ? result.error : ""));
  let sort = $state<CategorySort>("count-desc");
  const sortedRows = $derived(sortCategories(result?.rows ?? [], sort));

  const menus: IDropdownMenus = $derived({
    sort: {
      label: "Sort options",
      items: [
        {
          label: "Sort by category name (A-Z)",
          icon: ArrowDownAZIcon,
          active: sort === "category-asc",
          action: () => {
            sort = "category-asc";
          },
        },
        {
          label: "Sort by category name (Z-A)",
          icon: ArrowDownZAIcon,
          active: sort === "category-desc",
          action: () => {
            sort = "category-desc";
          },
        },
        {
          label: "Sort by category count (0-1)",
          icon: ArrowDown01Icon,
          active: sort === "count-asc",
          action: () => {
            sort = "count-asc";
          },
        },
        {
          label: "Sort by category count (1-0)",
          icon: ArrowDown10Icon,
          active: sort === "count-desc",
          action: () => {
            sort = "count-desc";
          },
        },
      ],
    },
  });
</script>

<Card.Root class="gap-2">
  <Card.Header>
    <Card.Title>Annotation by category</Card.Title>
    <Card.Action class="flex items-center gap-2">
      <span class="text-muted-foreground max-w-48 truncate text-xs" title={controller.categoryScopeLabel}>
        {controller.categoryScopeLabel}
      </span>

      <DropdownMenus {menus} align="end">
        {#snippet trigger({ props })}
          <Button variant="ghost" size="sm" {...props} class="bg-accent transition-colors">
            {#if sort === "category-asc"}<ArrowDownAZIcon />
            {:else if sort === "category-desc"}<ArrowDownZAIcon />
            {:else if sort === "count-asc"}<ArrowDown01Icon />
            {:else if sort === "count-desc"}<ArrowDown10Icon />
            {:else}<ArrowUpDownIcon />{/if}
            Sort
          </Button>
        {/snippet}
      </DropdownMenus>

      <Button
        variant="outline"
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
          {#each sortedRows as row (row.id)}
            {@const share = categoryShare(row.annotation_count, result.total ?? 0)}
            {@const slashIndex = row.category.lastIndexOf("/")}
            <div
              class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 py-2 pr-2 sm:grid-cols-[minmax(8rem,3fr)_minmax(0,7fr)_auto_auto]"
            >
              <div class="col-start-1 row-start-1 min-w-0">
                <HoverCard.Root>
                  <HoverCard.Trigger
                    class="flex max-w-full min-w-0 cursor-pointer items-center gap-1.5 text-left text-sm font-medium"
                    aria-label={`${row.category}: show category details and datasets`}
                    title={row.category}
                  >
                    <span class="flex min-w-0">
                      {#if slashIndex >= 0}
                        <span class="min-w-0 truncate underline decoration-dotted underline-offset-4">
                          {row.category.slice(0, slashIndex + 1)}
                        </span>
                      {/if}
                      <span class="max-w-full shrink-0 truncate underline decoration-dotted underline-offset-4">
                        {row.category.slice(slashIndex + 1)}
                      </span>
                    </span>
                  </HoverCard.Trigger>
                  <HoverCard.Content align="start" class="max-w-[calc(100vw-2rem)] text-xs">
                    <p class="font-medium break-words">{row.label}</p>
                    <p class="text-muted-foreground mt-1 break-all">ID: {row.category}</p>
                    <p class="mt-3 font-medium">Contributing datasets</p>
                    <ul class="mt-1 max-h-48 space-y-1 overflow-y-auto">
                      {#each row.datasets as dataset (dataset.id)}
                        <li class="flex justify-between gap-3">
                          <span class="min-w-0 break-words">{dataset.name}</span>
                          <span class="shrink-0 tabular-nums">{dataset.annotation_count.toLocaleString()}</span>
                        </li>
                      {/each}
                    </ul>
                  </HoverCard.Content>
                </HoverCard.Root>
              </div>
              <Progress
                class="col-span-3 col-start-1 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                value={share.value}
                aria-label={`${row.category}: ${row.annotation_count.toLocaleString()} annotations, ${share.label} of total`}
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
