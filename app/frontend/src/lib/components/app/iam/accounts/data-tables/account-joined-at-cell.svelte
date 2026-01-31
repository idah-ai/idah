<script lang="ts">
  import { isPast } from "date-fns";

  import DateText from "@/components/app/texts/date-text.svelte";
  import Badge from "@/components/ui/badge/badge.svelte";

  import { AccountRecord } from "@/data/model/iam/accounts/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: account }: DataTableCellBaseProps<AccountRecord> = $props();
  let { invitation_expired_at } = $derived(account);
  let invitationExpired = $derived(invitation_expired_at ? isPast(invitation_expired_at) : false);
</script>

{#if account.joined_at}
  <DateText datetime={account.joined_at} datetimeFormat="MMM dd, yyyy HH:mm:ss" size="sm" showTooltip></DateText>
{:else if invitationExpired}
  <Badge variant="destructive">Invite Expired</Badge>
{:else}
  <Badge variant="outline">Invite Pending</Badge>
{/if}
