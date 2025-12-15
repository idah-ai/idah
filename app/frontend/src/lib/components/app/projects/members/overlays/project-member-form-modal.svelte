<script lang="ts">
  import { page } from "$app/state";
  import { toast } from "svelte-sonner";

  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import ProjectMemberForm from "@/components/app/projects/members/forms/project-member-form.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";

  import {
      projectMembersBackendDataSource,
      type ProjectMemberRole,
  } from "@/data/model/dataset/projects/members/record";
  import { createMultipleProjectMembersSchema } from "@/data/model/dataset/projects/members/schema";
  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

  // Props
  let { action, open = $bindable() }: FormModalBaseProps = $props();

  // Variables
  const currentAccount = $authStatus.authContext;
  
  let projectId: string | undefined = $derived(page.params.projectId);
  let submitting: boolean = $state(false);
  let members: Array<{ email: string; role: ProjectMemberRole | null }> = $state([{ email: "", role: null }]);
  let disabledSubmitButton: boolean = $derived.by(() => {
    const validated = createMultipleProjectMembersSchema.safeParse(members);
    return !validated.success;
  });

  // Functions
  function closeThisModal(): void {
    open = false;
    submitting = false;
  }

  function resetForm(): void {
    members = [{ email: "", role: null }];
  }

  async function createProjectMember(): Promise<void> {
    if (!currentAccount) return;

    try {
      for (const member of members) {
        const { email, role } = member;
        let account: AccountRecord;

        /** Check if member is already invited */
        const existingAccount = await accountsBackendDataSource.list({ filters: { email: email } });

        if (!existingAccount.data.length) {
          /** If account does not exist, create an account first */
          const createdAccount = await accountsBackendDataSource.create({
            attributes: { email: email, enabled: true },
          });
          account = createdAccount.data;
        } else {
          account = existingAccount.data[0];
        }

        /** Check if member is already in the project */
        const existingProjectMember = await projectMembersBackendDataSource.list({
          filters: {
            project_id: projectId,
            account_id: account.id,
          },
        });

        if (existingProjectMember.data.length) {
          await accountsBackendDataSource.join({ id: account.id });
        }

        await projectMembersBackendDataSource.create({
          attributes: {
            project_id: projectId!,
            account_id: Number(account.id),
            name: account.name,
            email,
            role,
            invited_by_id: Number(currentAccount?.id),
          },
          relationships: {
            project: {
              data: {
                type: "dataset:projects",
                id: projectId,
              },
            },
          },
        });
      }

      $refetches.projectMembers.list = new Date();
      closeThisModal();
      toast.success(`${members.length} member(s) invite sent!`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to send invite. Please try again.");
    }
  }

  async function submit(): Promise<void> {
    submitting = true;

    try {
      const validated = createMultipleProjectMembersSchema.safeParse(members);

      if (!validated.success) {
        submitting = false;
        return;
      }

      await createProjectMember();
    } catch (error) {
      console.error(error);
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
    <Button loading={submitting} loadingLabel="Sending" disabled={disabledSubmitButton} onclick={submit}>
      Send Invite
    </Button>
  {/snippet}
</FormModal>
