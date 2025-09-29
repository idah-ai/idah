<script lang="ts">
  import Link from "@/components/ui/text/Link.svelte";
  import { page } from "$app/state";

  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";

  // Props
  interface Props extends DataTableCellBaseProps<DatasetRecord> {}
  let { record: dataset }: Props = $props();

  // Variables
  let projectId = $derived(page.params.projectId);
</script>

<Link href="/projects/{projectId}/datasets/{dataset.id}/tasks" showIcon>
  {dataset.name}
</Link>
