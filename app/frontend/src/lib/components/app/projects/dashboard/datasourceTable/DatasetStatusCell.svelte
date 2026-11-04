<script lang="ts">
  import StatusStack from "@/components/app/projects/dashboard/StatusStack.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  import type { DatasetTableContexts } from "@/components/app/projects/dashboard/DashboardData";

  // Props
  let { record, contexts }: { record: DatasetRecord; contexts?: Partial<DatasetTableContexts> } = $props();

  // Variables
  const counts = $derived(contexts?.countsByDataset?.[record.id]);
</script>

{#if counts}<div class="w-48"><StatusStack {counts} compact /></div>{:else}<span class="text-muted-foreground text-xs"
    >Unavailable · refresh to retry</span
  >{/if}
