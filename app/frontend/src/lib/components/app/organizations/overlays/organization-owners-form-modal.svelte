<script lang="ts">
  import { page } from "$app/state";
  import { toast } from "svelte-sonner";

  import OrganizationOwnersForm from "@/components/app/organizations/forms/organization-owners-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { DialogTitle } from "@/components/ui/dialog";

  import { accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

  // Props
  let { action, open = $bindable(), title }: FormModalBaseProps = $props();

  // Variables
  let organizationId = page.params.organizationId as string;
  let newRecord: boolean = $derived(action === "create");
  let submitting: boolean = $state(false);
  let owners: Array<string> = $state([]);

  let disabledSubmitButton = $derived.by(() => {
    return owners.length === 0;
  });

  // Functions
  function closeThisModal(): void {
    open = false;
  }

  function resetForm(): void {
    owners = [];
  }

  async function addOrgOwners() {
    for (const accountId of owners) {
      /** Get latest account data */
      const { data: account } = await accountsBackendDataSource.get(accountId, {
        noCache: true,
      });

      /** Skip if account is admin */
      if (account.role_name === "admin") continue;

      /** Update role_name and role_scope */
      await accountsBackendDataSource.update(
        account.id,
        {
          attributes: {
            role_name: "org_owner",
            role_scope: {
              ...account.role_scope,
              org: [...(account.role_scope.org || []), String(organizationId)],
            },
          },
        },
        {
          showErrorToast: false,
        },
      );
    }

    closeThisModal();
    $refetches.accounts.list = new Date();
    toast.success("Organization owner(s) added", {
      description: "The organization owner(s) has been added.",
    });
  }

  async function submit() {
    submitting = true;

    try {
      if (newRecord) {
        await addOrgOwners();
      }
    } catch (error) {
      showActionFailedToast(error);
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal {action} {title} loading={submitting} onCancel={resetForm} onConfirm={submit} bind:open>
  {#snippet modalTitle()}
    <DialogTitle>Add {title}</DialogTitle>
  {/snippet}

  <OrganizationOwnersForm bind:owners />

  {#snippet confirm()}
    <Button loading={submitting} loadingLabel="Adding" disabled={disabledSubmitButton} onclick={submit}>
      Add {title}
    </Button>
  {/snippet}
</FormModal>
