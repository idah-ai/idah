<script lang="ts">
  import type { Snippet } from "svelte";

  import AccountAvatar from "@/components/app/iam/accounts/avatars/account-avatar.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";

  // Props
  interface Props {
    memberAccountId: number | null;
    slotUnassigned?: Snippet;
  }
  let { memberAccountId, slotUnassigned }: Props = $props();

  // Functions
  async function fetchProjectMember() {
    if (!memberAccountId) {
      return undefined;
    }

    return await accountsBackendDataSource.get(String(memberAccountId), {
      fields: {
        [AccountRecord.type]: ["name", "email", "picture_url"],
      },
    });
  }
</script>

{#await fetchProjectMember()}
  <Spinner size="sm"></Spinner>
{:then projectMemberRes}
  {#if projectMemberRes}
    {@const { name, email, picture_url: pictureUrl } = projectMemberRes.data}

    <AccountAvatar size="sm" {name} {email} {pictureUrl} showEmail />
  {:else if slotUnassigned}
    {@render slotUnassigned()}
  {:else}
    <Text size="sm">Unassigned</Text>
  {/if}
{/await}
