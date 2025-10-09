<script lang="ts">
  import { page } from "$app/state";

  import Link from "@/components/ui/text/Link.svelte";

  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";

  // Props
  let { record: dataset }: DataTableCellBaseProps<DatasetRecord> = $props();

  // Variables
  let projectId = $derived(page.params.projectId);
</script>

<Link href="/projects/{projectId}/datasets/{dataset.id}/tasks" showIcon>
  {dataset.name}
</Link>
