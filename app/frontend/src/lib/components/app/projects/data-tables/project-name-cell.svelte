<script lang="ts">
  import Link from "@/components/ui/text/Link.svelte";

  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";
  import type { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  // Props
  interface Props extends DataTableCellBaseProps<ProjectRecord> {}
  let { record: project }: Props = $props();
</script>

<Link href="/projects/{project.id}/tasks" showIcon>
  {project.name}
</Link>
