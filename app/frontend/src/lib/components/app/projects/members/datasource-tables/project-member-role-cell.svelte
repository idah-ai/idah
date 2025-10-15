<script lang="ts">
  import { Badge } from "@/components/ui/badge";

  import { ProjectMemberRecord, projectMemberRoles } from "@/data/model/dataset/projects/members/record";
  import { humanize } from "@/utils/string";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: projectMember }: DataTableCellBaseProps<ProjectMemberRecord> = $props();
</script>

<Badge variant="outline">
  {projectMemberRoles.find((role) => role.value === projectMember.role)?.label || humanize(projectMember.role)}
</Badge>
