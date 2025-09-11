<script lang="ts">
  import Link from "@/components/ui/text/Link.svelte";

  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";

  // Props
  interface Props extends DataTableCellBaseProps<DatasetRecord> {}
  let { record: dataset }: Props = $props();

  // Access project ID from the relationship data using $derived
  let projectId = $derived(dataset._jsonapiData?.relationships?.project?.data?.id || "");
</script>

<Link href="/projects/{projectId}/datasets/{dataset.id}/tasks" showIcon>
  {dataset.name}
</Link>
