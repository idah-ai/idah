<script lang="ts">
  import { Badge } from "@/components/ui/badge";

  import { ProjectMemberRecord, projectMemberRoles } from "@/data/model/dataset/projects/members/record";
  import { humanize } from "@/utils/string";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  interface Props extends DataTableCellBaseProps<ProjectMemberRecord> {}
  let { record: projectMember }: Props = $props();
</script>

<Badge variant="outline" class="rounded-lg">
  {projectMemberRoles.find((role) => role.value === projectMember.role)?.label || humanize(projectMember.role)}
</Badge>
