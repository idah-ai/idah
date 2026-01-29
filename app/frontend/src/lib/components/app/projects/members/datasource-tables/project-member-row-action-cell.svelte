<script lang="ts">
  import { page } from "$app/state";
  import { UserRoundXIcon } from "@lucide/svelte";

  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import AccountEntries from "@/components/app/projects/entries/account-entries.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { resourcePath } from "@/data/BackendDataSource";
  import { clearCache } from "@/data/Cache";
  import { entriesBasePath } from "@/data/model/dataset/entries/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  interface Props extends DataTableCellBaseProps<ProjectMemberRecord> {
    record: ProjectMemberRecord;
  }
  let { record: projectMember }: Props = $props();

  // Variables
  let projectId = page.params.projectId as string;
  let openConfirmRemoveMemberModal: boolean = $state(false);

  // Functions
  async function removeProjectMember(): Promise<void> {
    try {
      await projectMembersBackendDataSource.delete(projectMember.id, { showErrorToast: false });

      openConfirmRemoveMemberModal = false;

      // Delete entries cache
      clearCache(resourcePath(entriesBasePath, null, undefined));

      $refetches.projectMembers.list = new Date();
      showToast.success({
        title: "Project member removed",
        description: `"${projectMember.email}" has been removed from the project.`,
      });
    } catch (error) {
      showActionFailedToast(error);
    }
  }
</script>

<Can
  action="delete"
  resource="dataset:project_members"
  scopes={[
    "as_org_owner",
    {
      as_user: {
        projectId,
        projectMemberRoles: ["project_owner"],
      },
    },
  ]}
>
  <Tooltips align="center">
    {#snippet trigger()}
      <Button variant="ghost" size="icon-sm" onclick={() => (openConfirmRemoveMemberModal = true)}>
        <UserRoundXIcon />
      </Button>
    {/snippet}

    {#snippet content()}
      Remove "{projectMember.email}" <br /> from project membership
    {/snippet}
  </Tooltips>

  <ConfirmModal
    title="Remove member"
    description={`Are you sure you want to remove "${projectMember.email}" from this project?`}
    onConfirm={removeProjectMember}
    bind:open={openConfirmRemoveMemberModal}
  >
    <AccountEntries accountId={projectMember.account_id} {projectId} />
  </ConfirmModal>
</Can>
