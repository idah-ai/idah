<script lang="ts">
  import { TooltipProvider } from "@/components/ui/tooltip";
  import Badge from "@/components/app/projects/dashboard/DeliveryBadge.svelte";
  import Chart from "@/components/app/projects/dashboard/CompletionHistoryChart.svelte";

  import type { DashboardRange } from "@/components/app/projects/dashboard/DashboardHistory";

  // Props
  let { range }: { range: DashboardRange } = $props();
</script>

<TooltipProvider>
  <Badge date="2026-03-08" counts={{ total: 2, completed: 0 }} />
  <Chart {range} interval="Day" />
</TooltipProvider>
