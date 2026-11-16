<script lang="ts">
  import { ChevronLeftIcon, ChevronRightIcon } from "@lucide/svelte";

  import DatasetSelector from "@/components/app/projects/dashboard/DatasetSelector.svelte";
  import {
    PROJECT_DASHBOARD_CONTROLLER_KEY,
    getProjectDashboardController,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";

  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";

  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
</script>

<section class="space-y-2" aria-label="Dashboard Dataset selection">
  <div class="flex flex-wrap items-end gap-4">
    <DatasetSelector
      projectId={controller.projectId}
      ids={controller.selectedDatasetIds}
      select={(ids) => void controller.select(ids)}
    />

    {#if controller.showDatasetNavigation}
      <div
        role="toolbar"
        tabindex="0"
        aria-label="Dataset view"
        aria-busy={controller.loading}
        class="bg-secondary flex h-9 max-w-full min-w-0 items-center gap-1 rounded-lg px-1"
        onkeydown={(event) => {
          if (event.target !== event.currentTarget || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
          event.preventDefault();
          controller.step(event.key === "ArrowLeft" ? -1 : 1);
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          class={controller.focused === null
            ? "bg-background text-primary hover:bg-background font-semibold shadow-sm"
            : "text-muted-foreground"}
          aria-pressed={controller.focused === null}
          disabled={controller.loading || controller.denied}
          onclick={() => controller.showAllDatasets()}
        >
          All datasets ({controller.selectedDatasetIds.length})
        </Button>

        <Separator orientation="vertical" class="mx-1 h-4" />

        <Button
          variant="ghost"
          size="icon-sm"
          class="size-7 shrink-0"
          aria-label="Previous dataset"
          disabled={controller.loading ||
            !controller.scopeReady ||
            controller.selectedDatasets.length === 0 ||
            (controller.focused !== null && controller.selectedDatasets.length === 1)}
          onclick={() => controller.step(-1)}
        >
          <ChevronLeftIcon class="size-3" />
        </Button>

        <span
          class={`inline-flex h-7 max-w-56 min-w-0 items-center rounded-md px-2 text-sm ${
            controller.focused ? "bg-background text-primary font-semibold shadow-sm" : "text-muted-foreground"
          }`}
        >
          <span class="truncate">{controller.focused?.name ?? "Select a dataset"}</span>
        </span>

        <Button
          variant="ghost"
          size="icon-sm"
          class="size-7 shrink-0"
          aria-label="Next dataset"
          disabled={controller.loading ||
            !controller.scopeReady ||
            controller.selectedDatasets.length === 0 ||
            (controller.focused !== null && controller.selectedDatasets.length === 1)}
          onclick={() => controller.step(1)}
        >
          <ChevronRightIcon class="size-3" />
        </Button>
      </div>
    {/if}
  </div>

  {#if controller.loading}
    <p class="text-muted-foreground text-sm" role="status">Loading Dataset scope…</p>
  {/if}

  {#if controller.error}
    <div class="flex flex-wrap items-center gap-2" role="alert">
      <p class="text-destructive text-sm">{controller.error}</p>
      <Button variant="outline" size="sm" disabled={controller.loading} onclick={() => void controller.retry()}>
        Try again
      </Button>
    </div>
  {/if}
</section>
