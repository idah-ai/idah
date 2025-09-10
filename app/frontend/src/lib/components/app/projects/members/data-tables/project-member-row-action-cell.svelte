<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";

  import { refetches } from "@/utils/refetch";
  import { Trash2Icon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";

  // Props
  interface Props {
    record: ProjectMemberRecord;
  }
  let { record: projectMember }: Props = $props();

  // Variables
  let openConfirmRemoveMemberModal: boolean = $state(false);

  // Functions
  async function removeProjectMember(): Promise<void> {
    await projectMembersBackendDataSource.delete(projectMember.id);
    $refetches.projectMembers.list++;
    openConfirmRemoveMemberModal = false;
    toast.success(`${projectMember.email} is removed!`);
  }
</script>

<Button variant="ghost" size="icon" onclick={() => (openConfirmRemoveMemberModal = true)}>
  <Trash2Icon class="size-4" />
</Button>

<ConfirmModal
  title="Remove member"
  description="Are you sure you want to remove this member from the project?"
  onConfirm={removeProjectMember}
  bind:open={openConfirmRemoveMemberModal}
></ConfirmModal>
