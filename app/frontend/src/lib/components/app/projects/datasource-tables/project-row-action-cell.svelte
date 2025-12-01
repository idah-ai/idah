<script lang="ts">
  import ProjectDropdownMenu from "@/components/app/projects/dropdowns/project-dropdown-menu.svelte";

  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: projectRecord }: DataTableCellBaseProps<ProjectRecord> = $props();
</script>

<ProjectDropdownMenu projectId={projectRecord.id} />
