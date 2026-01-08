<script lang="ts">
  import { toast } from "svelte-sonner";

  import AccountForm from "@/components/app/iam/accounts/forms/account-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

  import { refetches } from "@/utils/refetch";

  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { createAccountSchema, updateAccountSchema } from "@/data/model/iam/accounts/schema";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { getFieldErrors, validateData, type ZodSchema } from "@/utils/validate";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { Hash } from "@/utils/types";
  import { resourcePath } from "@/data/BackendDataSource";
  import { clearCache } from "@/data/Cache";
  import { projectMembersBasePath } from "@/data/model/dataset/projects/members/record";

  // Props
  interface Props extends FormModalBaseProps {
    accountRecord?: AccountRecord;
  }
  let { action, open = $bindable(), title, accountRecord }: Props = $props();

  // Variables
  let newRecord: boolean = $derived(action === "create");
  let fieldErrors: Hash = $state({});
  let submitting: boolean = $state(false);

  let account: AccountRecord = $derived(
    accountRecord
      ? accountRecord
      : new AccountRecord({
          type: AccountRecord.type,
          attributes: {
            name: null,
            email: null,
            role_name: "user",
            sso_channel: null,
            enabled: true,
          },
        }),
  );

  // Functions
  function closeThisModal(): void {
    open = false;
  }

  function resetForm(): void {
    fieldErrors = {};
    account = new AccountRecord({
      type: AccountRecord.type,
      attributes: {
        name: null,
        email: null,
        sso_channel: null,
        enabled: true,
      },
    });
  }

  function setValue(value: Hash): void {
    account.name = value.name;
    account.email = value.email;
    account.role_name = value.role_name;
    account.sso_channel = value.sso_channel;
    account.enabled = value.enabled;
  }

  async function createAccount(): Promise<void> {
    await accountsBackendDataSource.create(
      {
        attributes: {
          name: account.name,
          email: account.email,
          sso_channel: account.sso_channel,
          enabled: account.enabled,
          role_name: account.role_name,
        },
      },
      {
        showErrorToast: false,
      },
    );

    closeThisModal();
    $refetches.accounts.list = new Date();
    toast.success("Account created", {
      description: `The account has been created and an invitation email has been sent to "${account.email}".`,
    });
  }

  async function updateAccount(): Promise<void> {
    await accountsBackendDataSource.update(
      account.id,
      {
        attributes: {
          name: account.name,
          email: account.email,
          role_name: account.role_name,
          sso_channel: account.sso_channel,
          enabled: account.enabled,
        },
      },
      {
        showErrorToast: false,
      },
    );

    closeThisModal();

    // Delete project member cache to force refetch
    clearCache(resourcePath(projectMembersBasePath, null, undefined));

    $refetches.accounts.list = new Date();
    toast.success("Account updated", {
      description: `The account of "${account.email}" has been updated.`,
    });
  }

  async function submit(): Promise<void> {
    fieldErrors = {};
    submitting = true;
    const schema: ZodSchema = newRecord ? createAccountSchema : updateAccountSchema;

    try {
      const validated = validateData(schema, {
        name: account.name,
        email: account.email,
        role_name: account.role_name,
        sso_channel: account.sso_channel,
        enabled: account.enabled,
      });

      if (!validated.success) {
        fieldErrors = getFieldErrors(validated.error);
        submitting = false;
        return;
      }

      if (newRecord) {
        await createAccount();
      } else {
        await updateAccount();
      }
    } catch (error) {
      showActionFailedToast(error);
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal {action} {title} loading={submitting} onCancel={resetForm} onConfirm={submit} bind:open>
  <AccountForm {account} {newRecord} {fieldErrors} onValueChange={setValue} />
</FormModal>
