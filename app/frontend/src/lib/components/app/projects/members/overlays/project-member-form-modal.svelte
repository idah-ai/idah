<script lang="ts">
  import { page } from "$app/state";

  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import ProjectMemberForm from "@/components/app/projects/members/forms/project-member-form.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { createMultipleProjectMembersSchema } from "@/data/model/dataset/projects/members/schema";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { AssignProjectMemberType } from "@/data/model/dataset/projects/members/type";
  import type { JsonApiErrorResponse } from "@/data/model/types";

  // Props
  let { action, open = $bindable() }: FormModalBaseProps = $props();

  // Variables
  let projectId: string | undefined = $derived(page.params.projectId);
  let submitting: boolean = $state(false);
  let members: Array<AssignProjectMemberType> = $state([{ email: "", role: null, errors: [] }]);
  let disabledSubmitButton: boolean = $derived.by(() => {
    const validated = createMultipleProjectMembersSchema.safeParse(members);
    return !validated.success;
  });

  // Functions
  function closeThisModal(): void {
    open = false;
    submitting = false;
    resetForm();
  }

  function resetForm(): void {
    members = [{ email: "", role: null }];
  }

  async function inviteProjectMembers(): Promise<void> {
    if (!projectId) return;

    try {
      await projectMembersBackendDataSource.invite({
        project_id: projectId,
        members: members.map((member) => ({ email: member.email, role: member.role! })),
      });

      closeThisModal();
      $refetches.projectMembers.list = new Date();
      showToast.success({
        title: "Project member(s) invited",
        description: "An invitation will be sent to each account that has not joined yet.",
      });
    } catch (error) {
      submitting = false;
      throw error;
    }
  }

  // Map backend per-index validation errors (source.pointer = "/members/<i>")
  // onto the matching member row so each email shows its own reason.
  function applyPerEmailErrors(error: unknown): void {
    const err = error as JsonApiErrorResponse;
    if (!err?.errors) return;

    err.errors.forEach((e) => {
      const match = /^\/members\/(\d+)$/.exec(String(e.source?.pointer || ""));
      if (!match) return;

      const index = Number(match[1]);
      const member = members[index];
      if (member && e.detail) member.errors = [e.detail];
    });
  }

  async function submit(): Promise<void> {
    submitting = true;

    try {
      const validated = createMultipleProjectMembersSchema.safeParse(members);

      if (!validated.success) {
        submitting = false;
        return;
      }

      const emails = members.map((m) => m.email.toLowerCase());
      const hasDuplicates = emails.some((email, i) => emails.indexOf(email) !== i);

      if (hasDuplicates) {
        submitting = false;
        showToast.error({
          title: "Duplicate emails",
          description: "Each member must have a unique email address.",
        });
        return;
      }

      await inviteProjectMembers();
    } catch (error) {
      submitting = false;
      applyPerEmailErrors(error);

      // If no per-email errors were mapped, surface a generic failure toast.
      if (!members.some((m) => m.errors?.length)) {
        showActionFailedToast(error);
      }
    }
  }
</script>

<FormModal {action} title="Members" onCancel={resetForm} onConfirm={submit} bind:open>
  {#snippet modalTitle()}
    <DialogTitle>Invite Members</DialogTitle>
  {/snippet}

  <ProjectMemberForm bind:members />

  {#snippet confirm()}
    <Button loading={submitting} loadingLabel="Sending" disabled={disabledSubmitButton} onclick={submit}>
      Send Invite
    </Button>
  {/snippet}
</FormModal>
