<script lang="ts">
  import { page } from "$app/state";

  import Button from "@/components/ui/button/button.svelte";
  import DataTable from "@/components/app/data-table/data-table.svelte";
  import ProjectMemberFormModal from "@/components/app/projects/members/overlays/project-member-form-modal.svelte";

  import { projectMemberColumns } from "@/components/app/projects/members/data-tables/project-member-columns";
  import { PlusIcon } from "@lucide/svelte";
  import { refetches } from "@/utils/refetch";

  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { accountsBackendDataSource } from "@/data/model/iam/accounts/record";

  import type { CollectionResponse } from "@/data/model/types";
  import type { Hash } from "@/utils/types";
  import type { Record } from "@/data/model/Record";

  // Variables
  let projectId: string | undefined = $derived(page.params.projectId);
  let openNewProjectMemberFormModal: boolean = $state(false);

  // Functions
  function openNewProjectMemberModal(): void {
    openNewProjectMemberFormModal = true;
  }

  async function onLoadSetContexts<T extends Record = ProjectMemberRecord>(
    response: CollectionResponse<T>,
  ): Promise<Hash> {
    /** Fetch related accounts from accountIds */
    const accountIds = Array.from(new Set(response.data.map((member) => member.account_id).filter((id) => id)));
    const accountsRes = await accountsBackendDataSource.list({
      fields: {
        "iam:accounts": ["joined_at"],
      },
      filters: {
        id__in: accountIds,
      },
    });

    return { accounts: accountsRes.data };
  }
</script>

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
    {onLoadSetContexts}
  >
    {#snippet actions()}
      <Button onclick={openNewProjectMemberModal}>
        <PlusIcon class="size-4" />
        Invite Members
      </Button>
    {/snippet}
  </DataTable>
{/key}

<ProjectMemberFormModal action="create" title="Members" bind:open={openNewProjectMemberFormModal} />
