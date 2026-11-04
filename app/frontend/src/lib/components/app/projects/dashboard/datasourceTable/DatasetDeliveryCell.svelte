<script lang="ts">
  import { datasetDeliveryDate } from "@/components/app/projects/dashboard/DashboardStatus";
  import DeliveryBadge from "@/components/app/projects/dashboard/DeliveryBadge.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  import type { DatasetTableContexts } from "@/components/app/projects/dashboard/DashboardData";

  // Props
  let { record, contexts }: { record: DatasetRecord; contexts?: Partial<DatasetTableContexts> } = $props();

  // Variables
  const counts = $derived(
    contexts?.countsByDataset?.[record.id] ?? {
      total: record.entries_total_count,
      completed: record.entries_completed_count,
    },
  );
</script>

{#if counts}<DeliveryBadge date={datasetDeliveryDate(record)} {counts} />{:else}<span
    class="text-muted-foreground text-xs">Unavailable</span
  >{/if}
