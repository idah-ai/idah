<script lang="ts">
  import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
  import Copyable from "@/components/app/texts/copyable.svelte";
  import Spinner from "@/components/app/loading/spinner.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { getAvatarFallback } from "@/utils/string";
  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import type { Snippet } from "svelte";

  // Props
  interface Props {
    memberId: number | null;
    slotUnassigned?: Snippet;
  }
  let { memberId, slotUnassigned }: Props = $props();

  // Functions
  async function fetchProjectMember() {
    if (!memberId) {
      return undefined;
    }

    return await projectMembersBackendDataSource.get(String(memberId), {
      fields: {
        [ProjectMemberRecord.type]: ["name", "email"],
      },
    });
  }
</script>

{#await fetchProjectMember()}
  <Spinner></Spinner>
{:then projectMemberRes}
  {#if projectMemberRes}
    {@const { name, email } = projectMemberRes.data}

    <div class="flex items-center">
      <Avatar class="size-6">
        <AvatarImage></AvatarImage>
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
