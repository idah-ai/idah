<script lang="ts">
  import type { Snippet } from "svelte";

  import AccountAvatar from "@/components/app/iam/accounts/avatars/account-avatar.svelte";
  import Text from "@/components/ui/text/Text.svelte";
  import type { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";

  // Props
  interface Props {
    member: ProjectMemberRecord | null;
    slotUnassigned?: Snippet;
  }
  let { member, slotUnassigned }: Props = $props();
</script>

{#if member}
  {@const { name, email, picture_url: pictureUrl } = member}

  <AccountAvatar size="sm" {name} {email} {pictureUrl} showEmail />
{:else if slotUnassigned}
  {@render slotUnassigned()}
{:else}
  <Text size="sm">Unassigned</Text>
{/if}
