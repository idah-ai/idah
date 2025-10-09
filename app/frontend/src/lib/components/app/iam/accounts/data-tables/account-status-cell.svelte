<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";

  import { AccountRecord } from "@/data/model/iam/accounts/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: account }: DataTableCellBaseProps<AccountRecord> = $props();
</script>

<Badge variant={account.enabled ? "default" : "destructive"}>
  {account.enabled ? "Enabled" : "Disabled"}
</Badge>
