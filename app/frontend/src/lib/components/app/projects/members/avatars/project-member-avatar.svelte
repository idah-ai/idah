<script lang="ts">
  import type { Snippet } from "svelte";

  import Copyable from "@/components/app/texts/copyable.svelte";
  import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { getAvatarFallback } from "@/utils/string";
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
    {@const { name, email, picture_url } = projectMemberRes.data}

    <div class="flex items-center">
      <Avatar class="size-6 text-sm">
        <AvatarImage src={picture_url}></AvatarImage>
        <AvatarFallback>{getAvatarFallback(name || email)}</AvatarFallback>
      </Avatar>

      <Copyable title="email" value={email}></Copyable>
    </div>
  {:else if slotUnassigned}
    {@render slotUnassigned()}
  {:else}
    <Text size="sm">Unassigned</Text>
  {/if}
{/await}
