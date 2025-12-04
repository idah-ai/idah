<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";

  import { roles } from "@/data/model/iam/accounts/constants";
  import { AccountRecord } from "@/data/model/iam/accounts/record";
  import { humanize } from "@/utils/string";

  // Props
  interface Props {
    accountRecord: AccountRecord;
  }
  let { accountRecord }: Props = $props();

  // Variables
  let { role_name } = $derived(accountRecord);
  let roleName = $derived.by(() => {
    if (!role_name) return "Unassigned";

    const foundRole = roles.find((role) => role.value === role_name);

    return foundRole ? foundRole.label : humanize(role_name);
  });
</script>

<Badge variant="outline" rounded="full">
  {roleName}
</Badge>
