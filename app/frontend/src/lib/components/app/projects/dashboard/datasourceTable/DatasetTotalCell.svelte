<script lang="ts">
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  // Props
  let { record }: { record: DatasetRecord } = $props();
</script>

<span class="tabular-nums">{record.entries_total_count?.toLocaleString() ?? "—"}</span>
