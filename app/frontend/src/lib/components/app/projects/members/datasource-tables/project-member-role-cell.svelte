<script lang="ts">
  import ProjectMemberRoleBadge from "@/components/app/projects/members/badges/project-member-role-badge.svelte";

  import { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: projectMemberRecord }: DataTableCellBaseProps<ProjectMemberRecord> = $props();
</script>

<ProjectMemberRoleBadge {projectMemberRecord} />
