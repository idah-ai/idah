<script lang="ts">
  import { page } from "$app/state";
  import { UserRoundXIcon } from "@lucide/svelte";

  import MemberEntriesWarning from "@/components/app/projects/members/datasource-tables/member-entries-warning.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { showConfirmModal } from "@/components/app/overlays/modals/confirm-modal.service.svelte";
  import { ConfirmModalResult } from "@/components/app/overlays/modals/confirm-modal.types";
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

  // Functions
  async function confirmRemoveProjectMember(): Promise<void> {
    await showConfirmModal({
      title: "Remove member",
      description: `Are you sure you want to remove "${projectMember.email}" from this project?`,
      content: {
        component: MemberEntriesWarning,
        props: { accountId: projectMember.account_id, projectId },
      },
      onConfirm: async () => {
        try {
          await projectMembersBackendDataSource.delete(projectMember.id, { showErrorToast: false });

          // Delete entries cache
          clearCache(resourcePath(entriesBasePath, null, undefined));

          $refetches.projectMembers.list = new Date();
          showToast.success({
            title: "Project member removed",
            description: `"${projectMember.email}" has been removed from the project.`,
          });
        } catch (error) {
          showActionFailedToast(error);
          return ConfirmModalResult.KeepOpen;
        }
      },
    });
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
      <Button variant="ghost" size="icon-sm" onclick={confirmRemoveProjectMember}>
        <UserRoundXIcon />
      </Button>
    {/snippet}

    {#snippet content()}
      Remove "{projectMember.email}" <br /> from project membership
    {/snippet}
  </Tooltips>
</Can>
