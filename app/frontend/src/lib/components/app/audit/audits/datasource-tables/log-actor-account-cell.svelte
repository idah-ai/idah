<script lang="ts">
  import AccountAvatar from "@/components/app/iam/accounts/avatars/account-avatar.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { LogRecord } from "@/data/model/audit/logs/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import type { AccountRecord } from "@/data/model/iam/accounts/record";

  // Props
  let { record: logRecord, contexts }: DataTableCellBaseProps<LogRecord> = $props();

  // Contexts
  const accounts: AccountRecord[] = $derived(contexts?.accounts ?? []);
  const account = $derived(accounts.find((account) => account.id === String(logRecord.actor_account_id)));
</script>

{#if account}
  <AccountAvatar name={account.name} email={account.email} pictureUrl={account.picture_url} showName showEmail />
{:else}
  <Text size="sm" class="text-muted-foreground">
    Unknown Account (ID: {logRecord.actor_account_id})
  </Text>
{/if}
