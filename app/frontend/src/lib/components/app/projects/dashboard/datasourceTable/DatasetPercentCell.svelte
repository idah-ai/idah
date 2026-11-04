<script lang="ts">
  import type { DatasetTableContexts } from "@/data/model/dataset/projects/dashboard/record";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";

  // Props
  let { record, contexts }: { record: DatasetRecord; contexts?: Partial<DatasetTableContexts> } = $props();

  // Variables
  const counts = $derived(contexts?.countsByDataset?.[record.id]);
  const percentage = $derived(
    counts
      ? counts.total
        ? Math.round((counts.completed / counts.total) * 100)
        : 0
      : Number.isFinite(record.progress)
        ? Math.round(record.progress * 100)
        : null,
  );
</script>

<span class="whitespace-nowrap tabular-nums">{percentage === null ? "—" : `${percentage}%`}</span>
