<script lang="ts">
  import { page } from "$app/state";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import ProjectMemberFormModal from "@/components/app/projects/members/overlays/project-member-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { projectMemberColumns } from "@/components/app/projects/members/datasource-tables/project-member-columns";
  import { refetches } from "@/utils/refetch";
  import { PlusIcon } from "@lucide/svelte";

  import { projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";

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
  <DatasourceTable
    id="project-members-{projectId}"
    name="member"
    title="Members"
    refetchKey="projectMembers"
    columns={projectMemberColumns}
    dataSource={projectMembersBackendDataSource}
    listOptions={{
      filters: {
        project_id: projectId,
      },
    }}
  >
    {#snippet actions()}
      {@render InviteMemberButton()}
    {/snippet}

    {#snippet addNewRecordButton()}
      {@render InviteMemberButton()}
    {/snippet}
  </DatasourceTable>
{/key}

<ProjectMemberFormModal action="create" title="Members" bind:open={openNewProjectMemberFormModal} />
