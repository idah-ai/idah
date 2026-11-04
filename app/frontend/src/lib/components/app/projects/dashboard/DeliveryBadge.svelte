<script lang="ts">
  import { Badge } from "@/components/ui/badge";
  import { deliveryStatus } from "@/components/app/projects/dashboard/DashboardStatus";

  import type { Counts } from "@/data/model/dataset/projects/dashboard/record";

  // Props
  let { date, counts }: { date: string | null; counts: Pick<Counts, "total" | "completed"> } = $props();

  // Variables
  const status = $derived(deliveryStatus(date, counts));
</script>

<Badge variant="outline" rounded="full" class={`border-transparent ${status.color}`}>{status.label}</Badge>
