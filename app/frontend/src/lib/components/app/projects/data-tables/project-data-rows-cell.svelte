<script lang="ts">
  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";

  import type { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  // Props
  interface Props extends DataTableCellBaseProps<ProjectRecord> {}
  let { record: project }: Props = $props();

  // Variables
</script>

N/A
