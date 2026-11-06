<script lang="ts">
  import type { ComponentProps } from "svelte";

  import { TooltipProvider } from "@/components/ui/tooltip";
  import Chart from "@/components/app/projects/dashboard/CompletionHistoryChart.svelte";

  // Props
  let props: ComponentProps<typeof Chart> = $props();
</script>

<TooltipProvider><Chart {...props} /></TooltipProvider>
