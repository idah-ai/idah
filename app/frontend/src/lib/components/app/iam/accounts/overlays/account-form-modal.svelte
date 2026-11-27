<script lang="ts">
  import AccountForm from "@/components/app/iam/accounts/forms/account-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

  import { FormChangeTracker } from "@/utils/form/form-change-tracker.svelte";

  import { refetches } from "@/utils/refetch";

  import { getChangedAccountFields, serializeAccountFields } from "@/data/model/iam/accounts/form-values";
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
            role_scope: { org: [] },
            sso_channel: null,
            enabled: true,
          },
        }),
  );
  // Local edit buffer holding the current form values.
  let draft: Hash = $state({});

  const changeTracker = new FormChangeTracker(serializeAccountFields, () => accountRecord);

  // Functions
  function closeThisModal(): void {
    open = false;
  }

  function resetForm(): void {
    fieldErrors = {};
    changeTracker.reset();
    draft = {};
  }

  function setValue(value: Hash): void {
    draft = { ...value };
    changeTracker.update(value);
  }

  async function createAccount(): Promise<void> {
    // Account creation goes through the guarded invite endpoint; the backend
    // decides the assignable role and scope.
    await accountsBackendDataSource.invite({
      name: draft.name,
      email: draft.email,
      role_name: draft.role_name,
      role_scope: draft.role_name === "org_owner" ? serializeAccountFields(draft).role_scope : undefined,
    });

    closeThisModal();
    $refetches.accounts.list = new Date();
    showToast.success({
      title: "Account invited",
      description: `The account has been invited and an invitation email has been sent to "${draft.email}".`,
    });
  }

  async function updateAccount(attributes: Hash): Promise<void> {
    await accountsBackendDataSource.update(accountRecord!.id, { attributes }, { showErrorToast: false });

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
      const attributes = newRecord ? serializeAccountFields(draft) : getChangedAccountFields(accountRecord, draft);
      if (!newRecord && Object.keys(attributes).length === 0) return;
      const validated = validateData(
        schema,
        newRecord
          ? { ...attributes, email: draft.email }
          : {
              ...attributes,
              role_name: attributes.role_scope ? draft.role_name : attributes.role_name,
            },
      );

      if (!validated.success) {
        fieldErrors = getFieldErrors(validated.error);
        submitting = false;
        return;
      }

      if (newRecord) {
        await createAccount();
      } else {
        await updateAccount(attributes);
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
  disabled={action === "update" ? !changeTracker.hasUnsavedChanges : false}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  <AccountForm {account} {newRecord} {fieldErrors} onValueChange={setValue} />
</FormModal>
