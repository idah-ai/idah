<script lang="ts">
  import StackedProgressBar from "@/components/app/charts/bars/stacked-progress-bar.svelte";
  import { statusGroups } from "@/components/app/projects/dashboard/DashboardStatus";

  import type { Counts } from "@/components/app/projects/dashboard/DashboardData";

  // Props
  let { counts, compact = false }: { counts: Counts; compact?: boolean } = $props();

  // Variables
  const groups = $derived(statusGroups(counts));
  const known = $derived(counts.total - counts.residual);
</script>

<div
  class="space-y-4"
  title={groups
    .map((g) => `${g.label}: ${g.value} (${counts.total ? ((g.value / counts.total) * 100).toFixed(2) : "0.00"}%)`)
    .join(" · ")}
>
  <div
    class="bg-muted min-w-32 rounded-sm"
    role="img"
    aria-label={groups.map((g) => `${g.label}: ${g.value}`).join("; ") + `; ${counts.residual} outside groups`}
  >
    {#if known > 0}<div class="status-stack" class:compact style={`width:${(known / counts.total) * 100}%`}>
        <StackedProgressBar values={groups.filter((g) => g.value > 0)} />
      </div>{:else}<div class={compact ? "h-2" : "h-6"}></div>{/if}
  </div>
  {#if !compact}<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {#each groups as group (group.label)}<div>
          <p class="text-muted-foreground flex items-center gap-2 text-xs">
            <span class={`size-2 shrink-0 rounded-sm ${group.bgColor}`}></span>{group.label}
          </p>
          <p class="mt-1 text-2xl font-semibold tabular-nums">{group.value.toLocaleString()}</p>
          <p class="text-muted-foreground text-xs whitespace-nowrap">
            {counts.total ? ((group.value / counts.total) * 100).toFixed(2) : "0.00"}% of entries
          </p>
        </div>{/each}
    </div>{/if}
  {#if counts.residual}<p class="text-muted-foreground text-xs">
      {counts.residual.toLocaleString()} entries outside these workflow groups.
    </p>{/if}
</div>

<style>
  .status-stack :global(> div > div:last-child) {
    display: none;
  }
  .status-stack :global(span) {
    display: none;
  }
  .status-stack :global(> div > div:first-child > div) {
    padding: 0;
  }
  .compact :global(> div > div:first-child),
  .compact :global(> div > div:first-child > div) {
    height: 8px;
  }
</style>
