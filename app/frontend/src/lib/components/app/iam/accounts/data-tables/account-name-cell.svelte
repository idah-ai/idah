<script lang="ts">
  import AccountAvatar from "@/components/app/iam/accounts/avatars/account-avatar.svelte";

  import { AccountRecord } from "@/data/model/iam/accounts/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: accountRecord }: DataTableCellBaseProps<AccountRecord> = $props();

  // Variables
  let { name, email, picture_url: pictureUrl } = $derived(accountRecord);
</script>

<AccountAvatar {name} {email} {pictureUrl} showName />
