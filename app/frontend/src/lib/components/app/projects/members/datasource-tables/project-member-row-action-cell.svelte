<script lang="ts">
  import { UserRoundXIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { refetches } from "@/utils/refetch";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  interface Props extends DataTableCellBaseProps<ProjectMemberRecord> {
    record: ProjectMemberRecord;
  }
  let { record: projectMember }: Props = $props();

  // Variables
  let openConfirmRemoveMemberModal: boolean = $state(false);

  // Functions
  async function removeProjectMember(): Promise<void> {
    await projectMembersBackendDataSource.delete(projectMember.id);
    $refetches.projectMembers.list = new Date();
    openConfirmRemoveMemberModal = false;
    toast.success(`${projectMember.email} is removed!`);
  }
</script>

<Can action="delete" resource="dataset:project_members" scopes={["as_org_owner"]}>
  <Button variant="ghost" size="icon-sm" onclick={() => (openConfirmRemoveMemberModal = true)}>
    <UserRoundXIcon />
  </Button>

  <ConfirmModal
    title="Remove member"
    description="Are you sure you want to remove this member from the project?"
    onConfirm={removeProjectMember}
    bind:open={openConfirmRemoveMemberModal}
  ></ConfirmModal>
</Can>
