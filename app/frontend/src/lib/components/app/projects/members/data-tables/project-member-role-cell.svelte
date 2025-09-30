<script lang="ts">
  import { Badge } from "@/components/ui/badge";

  import { humanize } from "@/utils/string";
  import { ProjectMemberRecord, projectMemberRoles } from "@/data/model/dataset/projects/members/record";

  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";

  // Props
  let { record: projectMember }: DataTableCellBaseProps<ProjectMemberRecord> = $props();
</script>

<Badge variant="outline">
  {projectMemberRoles.find((role) => role.value === projectMember.role)?.label || humanize(projectMember.role)}
</Badge>
