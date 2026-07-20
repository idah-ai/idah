<script lang="ts">
  import AccountForm from "@/components/app/iam/accounts/forms/account-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

  import { refetches } from "@/utils/refetch";

  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { createAccountSchema, updateAccountSchema } from "@/data/model/iam/accounts/schema";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { getFieldErrors, validateData, type ZodSchema } from "@/utils/validate";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { resourcePath } from "@/data/BackendDataSource";
  import { clearCache } from "@/data/Cache";
  import { entriesBasePath } from "@/data/model/dataset/entries/record";
  import { projectMembersBasePath } from "@/data/model/dataset/projects/members/record";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    accountRecord?: AccountRecord;
  }
  let { action, open = $bindable(), title, accountRecord }: Props = $props();

  // Variables
  let newRecord: boolean = $derived(action === "create");
  let fieldErrors: Hash = $state({});
  let submitting: boolean = $state(false);

  // Read-only seed for <AccountForm>; never mutated here.
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
  // Local edit buffer holding the current form values.
  let draft: Hash = $state({});

  // Single source of truth for the dirty comparison. Keys MUST be limited to
  // fields the form emits via onValueChange (name, email, role_name, enabled) —
  // used for BOTH the original-record and current-value snapshots. sso_channel
  // is displayed but read-only and never emitted, so it must not be diffed.
  function serializeEditableFields(source: Hash): Hash {
    return {
      name: source.name,
      email: source.email,
      role_name: source.role_name,
      enabled: source.enabled,
    };
  }
  let savedSnapshot: string = $derived(accountRecord ? JSON.stringify(serializeEditableFields(accountRecord)) : "");
  let editedSnapshot: string | null = $state(null);
  let hasUnsavedChanges: boolean = $derived(editedSnapshot !== null && editedSnapshot !== savedSnapshot);

  // Functions
  function closeThisModal(): void {
    open = false;
  }

  function resetForm(): void {
    fieldErrors = {};
    editedSnapshot = null;
    draft = {};
  }

  function setValue(value: Hash): void {
    // sso_channel is read-only and not emitted by the form; it is sourced from
    // the original record at submit time, so it is intentionally absent here.
    draft = { ...value };
    editedSnapshot = JSON.stringify(serializeEditableFields(value));
  }

  async function createAccount(): Promise<void> {
    await accountsBackendDataSource.create(
      {
        attributes: {
          name: draft.name,
          email: draft.email,
          sso_channel: accountRecord?.sso_channel ?? null,
          enabled: draft.enabled,
          role_name: draft.role_name,
        },
      },
      {
        showErrorToast: false,
      },
    );

    closeThisModal();
    $refetches.accounts.list = new Date();
    showToast.success({
      title: "Account created",
      description: `The account has been created and an invitation email has been sent to "${draft.email}".`,
    });
  }

  async function updateAccount(): Promise<void> {
    await accountsBackendDataSource.update(
      accountRecord!.id,
      {
        attributes: {
          name: draft.name,
          email: draft.email,
          role_name: draft.role_name,
          sso_channel: accountRecord?.sso_channel ?? null,
          enabled: draft.enabled,
        },
      },
      {
        showErrorToast: false,
      },
    );

    closeThisModal();

    // Delete project member cache to force refetch
    clearCache(resourcePath(projectMembersBasePath, null, undefined));
    // Delete entries cache
    clearCache(resourcePath(entriesBasePath, null, undefined));

    $refetches.accounts.list = new Date();
    showToast.success({
      title: "Account updated",
      description: `The account of "${draft.email}" has been updated.`,
    });
  }

  async function submit(): Promise<void> {
    fieldErrors = {};
    submitting = true;
    const schema: ZodSchema = newRecord ? createAccountSchema : updateAccountSchema;

    try {
      const validated = validateData(schema, {
        name: draft.name,
        email: draft.email,
        role_name: draft.role_name,
        sso_channel: accountRecord?.sso_channel ?? null,
        enabled: draft.enabled,
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

<FormModal
  {action}
  {title}
  loading={submitting}
  disabled={action === "update" ? !hasUnsavedChanges : false}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  <AccountForm {account} {newRecord} {fieldErrors} onValueChange={setValue} />
</FormModal>
