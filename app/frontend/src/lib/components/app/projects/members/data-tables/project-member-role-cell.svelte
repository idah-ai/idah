<script lang="ts">
  import { Badge } from "@/components/ui/badge";

  import { humanize } from "@/utils/string";
  import { ProjectMemberRecord, projectMemberRoles } from "@/data/model/dataset/projects/members/record";

  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";

  // Props
  interface Props extends DataTableCellBaseProps<ProjectMemberRecord> {}
  let { record: projectMember }: Props = $props();
</script>

<Badge variant="outline" class="rounded-lg">
  {projectMemberRoles.find((role) => role.value === projectMember.role)?.label || humanize(projectMember.role)}
</Badge>
