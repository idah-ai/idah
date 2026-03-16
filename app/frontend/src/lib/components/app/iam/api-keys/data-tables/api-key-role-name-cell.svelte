<script lang="ts">
  import AccountRoleBadge from "@/components/app/iam/accounts/badges/account-role-badge.svelte";

  import { AccountRecord } from "@/data/model/iam/accounts/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: accountRecord }: DataTableCellBaseProps<AccountRecord> = $props();
</script>

<AccountRoleBadge {accountRecord} />
