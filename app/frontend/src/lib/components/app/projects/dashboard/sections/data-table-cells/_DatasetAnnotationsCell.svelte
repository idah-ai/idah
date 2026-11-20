<script lang="ts">
  import { onDestroy } from "svelte";
  import * as Popover from "@/components/ui/popover/index";
  import Separator from "@/components/ui/separator/separator.svelte";
  import Skeleton from "@/components/ui/skeleton/skeleton.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import {
    getProjectDashboardController,
    PROJECT_DASHBOARD_CONTROLLER_KEY,
  } from "@/components/app/projects/dashboard/project-dashboard-controller.svelte";

  interface Props {
    row: DatasetRecord;
  }
  let { row: dataset }: Props = $props();
  const controller = getProjectDashboardController(PROJECT_DASHBOARD_CONTROLLER_KEY);
  const result = $derived(controller.datasetAnnotations[dataset.id]);
  let open = $state(false);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function cancelClose(): void {
    clearTimeout(closeTimer);
  }
  function scheduleClose(event: PointerEvent): void {
    if (event.pointerType !== "mouse") return;
    cancelClose();
    closeTimer = setTimeout(() => {
      open = false;
    }, 180);
  }
  function showOnHover(event: PointerEvent): void {
    if (event.pointerType !== "mouse") return;
    cancelClose();
    open = true;
  }
  onDestroy(cancelClose);
  $effect(() => {
    if (dataset.id && result) {
      open = false;
      cancelClose();
    }
  });
</script>

{#if !result || result.status === "loading"}
  <span role="status" aria-label={`Loading annotations for ${dataset.name}`}>
    <Skeleton class="ml-auto h-4 w-10" />
  </span>
{:else if result.status === "error"}
  <Popover.Root>
    <Popover.Trigger
      class="text-muted-foreground underline decoration-dotted underline-offset-4"
      aria-label={`Annotation count unavailable for ${dataset.name}`}>Unavailable</Popover.Trigger
    >
    <Popover.Content align="end" class="text-xs">
      <p>{result.error}</p>
      <Button
        class="mt-2"
        variant="outline"
        size="sm"
        disabled={controller.denied}
        onclick={() => void controller.retryDatasetAnnotations()}>Retry</Button
      >
    </Popover.Content>
  </Popover.Root>
{:else}
  <Popover.Root bind:open>
    <Popover.Trigger
      class="text-primary cursor-pointer tabular-nums underline decoration-dotted underline-offset-4"
      aria-label={`${result.total?.toLocaleString()} annotations in ${dataset.name}; show categories`}
      onpointerenter={showOnHover}
      onpointerleave={scheduleClose}
    >
      {result.total?.toLocaleString()}
    </Popover.Trigger>
    <Popover.Content
      align="end"
      side="bottom"
      class="max-w-[calc(100vw-2rem)] p-0 text-xs"
      onOpenAutoFocus={(event) => event.preventDefault()}
      onpointerenter={cancelClose}
      onpointerleave={scheduleClose}
    >
      <div class="flex items-start justify-between gap-3 p-3">
        <span class="min-w-0 break-words">{dataset.name} · Categories</span>
        <span class="shrink-0 font-semibold tabular-nums">{result.total?.toLocaleString()}</span>
      </div>
      <Separator />
      <div class="max-h-64 overflow-y-auto p-1">
        {#each result.rows as row (row.id)}
          <div class="flex items-start justify-between gap-4 p-2">
            <div class="min-w-0">
              <span class="break-words">{row.label}</span>
              {#if result.rows.some((other) => other.category !== row.category && other.label === row.label)}
                <p class="text-muted-foreground break-all">{row.category}</p>
              {/if}
              {#if !row.configured}<p class="text-muted-foreground">Unconfigured</p>{/if}
            </div>
            <span class="shrink-0 font-semibold tabular-nums">{row.annotation_count.toLocaleString()}</span>
          </div>
        {:else}
          <p class="text-muted-foreground p-2">No configured categories or annotations.</p>
        {/each}
      </div>
    </Popover.Content>
  </Popover.Root>
{/if}
