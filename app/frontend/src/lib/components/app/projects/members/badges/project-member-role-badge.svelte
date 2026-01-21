<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";

  import { ProjectMemberRecord, projectMemberRoles } from "@/data/model/dataset/projects/members/record";
  import { humanize } from "@/utils/string";

  // Props
  interface Props {
    projectMemberRecord: ProjectMemberRecord;
  }
  let { projectMemberRecord } = $props();

  // Variables
  let foundRole = $derived(projectMemberRoles.find((role) => role.value === projectMemberRecord.role));
</script>

<Badge variant="outline" rounded="full">
  {foundRole ? foundRole.label : humanize(projectMemberRecord.role)}
</Badge>
