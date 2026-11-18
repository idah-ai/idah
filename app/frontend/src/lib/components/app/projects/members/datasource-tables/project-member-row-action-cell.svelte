<script lang="ts">
  import { page } from "$app/state";
  import { RotateCcwIcon, UserRoundXIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import MemberEntriesWarning from "@/components/app/projects/members/datasource-tables/member-entries-warning.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { showConfirmModal } from "@/components/app/overlays/modals/confirm-modal.service.svelte";
  import { confirmModalResult } from "@/components/app/overlays/modals/confirm-modal.types";
  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { authStatus } from "@/security/AuthContext";
  import { canManageProjectMember } from "@/security/roleHierarchy";
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
  let { record: projectMember, contexts = {} }: Props = $props();

  // Variables
  let projectId = page.params.projectId as string;
  let canManageMember: boolean = $state(false);
  let canResendInvitation: boolean = $state(false);

  // Lifecycle
  onMount(async () => {
    const currentAccount = $authStatus.authContext;
    const effectiveRank = currentAccount ? await currentAccount.effectiveProjectRank(projectMember.project_id) : null;
    canManageMember = !!effectiveRank && canManageProjectMember(effectiveRank, String(projectMember.role));

    // Resend is offered only for members whose account has not joined. The
    // joined status is resolved on read by the members page and passed via
    // `contexts` (a map of account_id → joined_at).
    const joinedAt = contexts.accountJoinedAt?.[projectMember.account_id];
    canResendInvitation = canManageMember && !joinedAt;
  });

  // Functions
  async function confirmRemoveProjectMember(): Promise<void> {
    await showConfirmModal({
      title: "Remove Member",
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
          return confirmModalResult.KeepOpen;
        }
      },
    });
  }

  async function resendInvitation(): Promise<void> {
    try {
      await projectMembersBackendDataSource.resend_invitation({ id: projectMember.id });
      $refetches.projectMembers.list = new Date();
      showToast.success({
        title: "Invitation resent",
        description: `The invitation for "${projectMember.email}" has been resent.`,
      });
    } catch (error) {
      showActionFailedToast(error);
    }
  }
</script>

{#if canManageMember}
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
{/if}

{#if canResendInvitation}
  <Tooltips align="center">
    {#snippet trigger()}
      <Button variant="ghost" size="icon-sm" onclick={resendInvitation}>
        <RotateCcwIcon />
      </Button>
    {/snippet}

    {#snippet content()}
      Resend invitation to "{projectMember.email}"
    {/snippet}
  </Tooltips>
{/if}
