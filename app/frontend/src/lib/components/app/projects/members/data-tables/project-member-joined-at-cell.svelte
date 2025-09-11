<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";

  import { AccountRecord } from "@/data/model/iam/accounts/record";
  import { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";

  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";

  // Props
  interface Props extends DataTableCellBaseProps<ProjectMemberRecord> {}
  let { record: projectMember, contexts }: Props = $props();

  // Variables
  const { accounts } = contexts as { accounts: AccountRecord[] };
  const account = $derived(accounts.find((account) => account.id == projectMember.account_id));
</script>

{#if account?.joined_at}
  <DateText datetime={account.joined_at} datetimeFormat="MMM dd, yyyy HH:mm:ss" size="sm" showTooltip></DateText>
{:else}
  <Badge variant="outline">Invite Pending</Badge>
{/if}
