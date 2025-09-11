<script lang="ts">
  import DataTable from "@/components/app/data-table/data-table.svelte";

  import { projectTaskColumns } from "@/components/app/projects/tasks/data-tables/project-task.columns";
</script>

<DataTable id="project-task" name="task" columns={projectTaskColumns}></DataTable>
