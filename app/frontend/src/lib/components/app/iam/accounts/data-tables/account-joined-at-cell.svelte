<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";

  import { AccountRecord } from "@/data/model/iam/accounts/record";

  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";

  // Props
  interface Props extends DataTableCellBaseProps<AccountRecord> {}
  let { record: account }: Props = $props();
</script>

{#if account.joined_at}
  <DateText datetime={account.joined_at} datetimeFormat="MMM dd, yyyy HH:mm:ss" size="sm" showTooltip></DateText>
{:else}
  <Badge variant="outline">Invite Pending</Badge>
{/if}
