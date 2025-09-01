<script lang="ts">
	import DataTable from "@/components/app/data-table/DataTable.svelte";

	import { projectTaskColumns } from "@/components/app/workflow/projects/tasks/data-tables/project-task.columns";
</script>

<DataTable id="project-task" name="task" columns={projectTaskColumns}></DataTable>
