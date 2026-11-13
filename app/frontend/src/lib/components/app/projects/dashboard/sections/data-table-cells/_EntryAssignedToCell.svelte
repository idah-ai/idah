<script lang="ts">
  import ProjectMemberAvatar from "@/components/app/projects/members/avatars/project-member-avatar.svelte";
  import AccountAvatar from "@/components/app/iam/accounts/avatars/account-avatar.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let { row: entry }: { row: EntryRecord } = $props();
</script>

{#if entry.assigned_to_id === null}
  <Text size="xs">Unassigned</Text>
{:else if entry.assigned_to?.email}
  <ProjectMemberAvatar member={entry.assigned_to} />
{:else if entry.assigned_to_email}
  <AccountAvatar size="sm" email={entry.assigned_to_email} showEmail />
{:else}
  <Text size="xs">Unassigned</Text>
{/if}
