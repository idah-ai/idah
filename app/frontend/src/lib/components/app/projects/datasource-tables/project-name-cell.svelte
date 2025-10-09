<script lang="ts">
  import Link from "@/components/ui/text/Link.svelte";

  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: project }: DataTableCellBaseProps<ProjectRecord> = $props();
</script>

<Link href="/projects/{project.id}/datasets" showIcon>
  {project.name}
</Link>
