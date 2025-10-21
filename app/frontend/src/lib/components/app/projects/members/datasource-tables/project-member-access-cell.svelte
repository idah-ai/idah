<script lang="ts">
  import { Badge } from "@/components/ui/badge";

  import { ProjectMemberRecord, projectMemberAccess } from "@/data/model/dataset/projects/members/record";
  import { humanize } from "@/utils/string";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: projectMember }: DataTableCellBaseProps<ProjectMemberRecord> = $props();
</script>

<Badge variant="outline">
  {projectMemberAccess.find((access) => access.value === projectMember.access)?.label || humanize(projectMember.access)}
</Badge>
