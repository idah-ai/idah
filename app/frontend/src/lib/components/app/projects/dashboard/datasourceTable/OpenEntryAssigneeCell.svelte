<script lang="ts">
  import AccountAvatar from "@/components/app/iam/accounts/avatars/account-avatar.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let { record }: { record: EntryRecord } = $props();

  // Variables
  const email = $derived(
    record.assigned_to_email ||
      (record._jsonapiData.relationships?.assigned_to?.data ? record.assigned_to?.email : null),
  );
</script>

{#if record.assigned_to_id == null}<Text size="sm">Unassigned</Text>{:else if email}<AccountAvatar
    size="sm"
    {email}
    showEmail
  />{:else}<Text size="sm">Assignment details unavailable</Text>{/if}
