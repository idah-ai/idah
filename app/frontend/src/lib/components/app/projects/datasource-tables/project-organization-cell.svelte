<script lang="ts">
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: project }: DataTableCellBaseProps<ProjectRecord> = $props();
</script>

{project.organization_id}
