<script lang="ts">
  import { page } from "$app/state";

  import Button from "@/components/ui/button/button.svelte";
  import DataTable from "@/components/app/data-table/data-table.svelte";
  import ProjectMemberFormModal from "@/components/app/projects/members/overlays/project-member-form-modal.svelte";

  import { projectMemberColumns } from "@/components/app/projects/members/data-tables/project-member-columns";
  import { PlusIcon } from "@lucide/svelte";
  import { refetches } from "@/utils/refetch";

  import { projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";

  import type { Record } from "@/data/model/Record";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";

  // Variables
  let projectId: string | undefined = $derived(page.params.projectId);
  let openNewProjectMemberFormModal: boolean = $state(false);

  // Functions
  function openNewProjectMemberModal(): void {
    openNewProjectMemberFormModal = true;
  }
</script>

{#snippet InviteMemberButton()}
  <Button onclick={openNewProjectMemberModal}>
    <PlusIcon class="size-4"></PlusIcon>
    Invite Members
  </Button>
{/snippet}

{#key $refetches.projectMembers.list}
  <DataTable
    id="project-members-{projectId}"
    name="member"
    columns={projectMemberColumns}
    dataSource={projectMembersBackendDataSource}
    listOptions={{
      filters: {
        project_id: projectId,
      },
    }}
    onNewRecord={openNewProjectMemberModal}
  >
    {#snippet actions()}
      {@render InviteMemberButton()}
    {/snippet}

    {#snippet emptyState()}
      <ResponseBlock title="No Project Members" description="Please add members to get started" icon={PlusIcon}>
        {#snippet actions()}
          {@render InviteMemberButton()}
        {/snippet}
      </ResponseBlock>
    {/snippet}
  </DataTable>
{/key}

<ProjectMemberFormModal action="create" title="Members" bind:open={openNewProjectMemberFormModal} />
