<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";

  import { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";

  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";

  // Props
  interface Props extends DataTableCellBaseProps<ProjectMemberRecord> {}
  let { record: projectMember }: Props = $props();
</script>

{#if projectMember.joined_at}
  <DateText datetime={projectMember.joined_at} datetimeFormat="MMM dd, yyyy HH:mm:ss" size="sm" showTooltip></DateText>
{:else}
  <Badge variant="outline">Invite Pending</Badge>
{/if}
