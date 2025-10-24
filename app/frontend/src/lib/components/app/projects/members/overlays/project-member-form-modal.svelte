<script lang="ts">
  import { page } from "$app/state";
  import { toast } from "svelte-sonner";

  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import ProjectMemberForm from "@/components/app/projects/members/forms/project-member-form.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";

  import { refetches } from "@/utils/refetch";

  import { projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { createMultipleProjectMembersSchema } from "@/data/model/dataset/projects/members/schema";
  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

  // Props
  let { action, open = $bindable() }: FormModalBaseProps = $props();

  // Variables
  let projectId: string | undefined = $derived(page.params.projectId);
  let submitting: boolean = $state(false);
  let members: Array<{ email: string; access: string }> = $state([{ email: "", access: "" }]);
  let disabledSubmitButton: boolean = $derived.by(() => {
    const validated = createMultipleProjectMembersSchema.safeParse(members);
    return !validated.success;
  });

  // Functions
  function closeThisModal(): void {
    open = false;
  }

  function resetForm(): void {
    members = [{ email: "", access: "" }];
  }

  async function createProjectMember(): Promise<void> {
    const uniqueEmails = [...new Set(members.map((m) => m.email))];
    const existingAccounts = await accountsBackendDataSource.list({ filters: { email: uniqueEmails } });
    const existingEmails = existingAccounts.data.map((account) => account.email);
    const newEmails = uniqueEmails.filter((email) => !existingEmails.includes(email));

    const existingAccountIds = existingAccounts.data.map((account) => account.account_id);
    const existingProjectMembers = await projectMembersBackendDataSource.list({
      filters: {
        project_id: projectId,
        account_id: existingAccountIds,
      },
    });
    const existingProjectMemberAccountIds = existingProjectMembers.data.map((member) => member.account_id);

    try {
      for (const member of members) {
        const { email, access } = member;
        let account: AccountRecord | undefined;

        // Check if account email exists
        if (existingEmails.includes(email)) {
          account = existingAccounts.data.find((acc) => acc.email === email);
        } else {
          const createdAccount = await accountsBackendDataSource.create({
            attributes: { email: email, enabled: true },
          });
          account = createdAccount.data;
        }

        /** Check if member is not already in the project and should be invited */
        if (account?.id && !existingProjectMemberAccountIds.includes(Number(account.id))) {
          await projectMembersBackendDataSource.create({
            attributes: {
              project_id: projectId!,
              account_id: Number(account.id),
              name: account.name,
              email,
              access,
              invited_by_id: 1, // TODO: get id from context
            },
          });
        }
      }

      $refetches.projectMembers.list = new Date();
      closeThisModal();
      toast.success(`${members.length} member(s) invite sent!`);
    } catch (error) {
      toast.error("Failed to send invite. Please try again.");
      throw error;
    }
  }

  async function submit(): Promise<void> {
    submitting = true;

    try {
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
