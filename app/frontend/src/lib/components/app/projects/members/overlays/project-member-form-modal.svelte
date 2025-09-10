<script lang="ts">
  import { page } from "$app/state";

  import Button from "@/components/ui/button/button.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import ProjectMemberForm from "@/components/app/projects/members/forms/project-member-form.svelte";

  import { projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { refetches } from "@/utils/refetch";
  import { toast } from "svelte-sonner";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

  // Props
  interface Props extends FormModalBaseProps {}
  let { action, open = $bindable() }: Props = $props();

  // Variables
  let projectId: string | undefined = $derived(page.params.projectId);
  let submitting: boolean = $state(false);
  let members: Array<{ email: string; role: string }> = $state([{ email: "", role: "" }]);

  // Functions
  function closeThisModal(): void {
    open = false;
  }

  function resetForm(): void {
    members = [{ email: "", role: "" }];
  }

  async function createProjectMember(): Promise<void> {
    for (const member of members) {
      await projectMembersBackendDataSource.create({
        attributes: {
          project_id: projectId!,
          user_id: "1",
          email: member.email,
          role: member.role,
          invited_by_id: "1",
        },
      });
    }

    $refetches.projectMembers.list++;
    closeThisModal();
    toast.success(`${members.length} member(s) invite sent!`);
  }

  async function submit(): Promise<void> {
    submitting = true;

    try {
      await createProjectMember();
    } catch (error) {
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal {action} title="Members" onCancel={resetForm} onConfirm={submit} bind:open>
  {#snippet modalTitle()}
    <DialogTitle>Invite Members</DialogTitle>
  {/snippet}

  <ProjectMemberForm bind:members />

  {#snippet confirm()}
    <Button disabled={members.length === 0} onclick={submit}>Send Invite</Button>
  {/snippet}
</FormModal>
