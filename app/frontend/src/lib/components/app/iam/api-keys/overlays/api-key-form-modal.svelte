<script lang="ts">
  import ApiKeyForm from "@/components/app/iam/api-keys/forms/api-key-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

  import { FormChangeTracker } from "@/utils/form/form-change-tracker.svelte";

  import { refetches } from "@/utils/refetch";

  import { ApiKeyRecord, apiKeysBackendDataSource } from "@/data/model/iam/api-keys/record";
  import { createApiKeySchema, updateApiKeySchema } from "@/data/model/iam/api-keys/schema";
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
    apiKeyRecord?: ApiKeyRecord;
    onCreatedApiKey?: (apiKey: string) => void;
  }
  let { action, open = $bindable(), title, apiKeyRecord, onCreatedApiKey = () => {} }: Props = $props();

  // Variables
  let newRecord: boolean = $derived(action === "create");
  let fieldErrors: Hash = $state({});
  let submitting: boolean = $state(false);

  // Read-only seed for <ApiKeyForm>; never mutated here.
  let apiKey: ApiKeyRecord = $derived(
    apiKeyRecord
      ? apiKeyRecord
      : new ApiKeyRecord({
          type: ApiKeyRecord.type,
          attributes: {
            name: null,
            scope_type: "",
            scope_value: [],
            permissions: [],
            expires_at: null,
          },
        }),
  );
  // Local edit buffer holding the current form values.
  let draft: Hash = $state({});

  // Single source of truth for the dirty comparison. Keys MUST be limited to
  // fields the form emits via onValueChange — used for BOTH the original-record
  // snapshot and the current-value snapshot. Only name/expires_at are editable
  // on update (see updateApiKey payload).
  function serializeEditableFields(source: Hash): Hash {
    return {
      name: source.name,
      expires_at: source.expires_at,
    };
  }
  const changeTracker = new FormChangeTracker(serializeEditableFields, () => apiKeyRecord);

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

  async function createApiKey(): Promise<void> {
    const createdApiKeyRes = await apiKeysBackendDataSource.create(
      {
        attributes: {
          name: draft.name,
          scope_type: draft.scope_type,
          scope_value: draft.scope_value || [],
          permissions: draft.permissions || [],
          expires_at: draft.expires_at,
        },
      },
      {
        showErrorToast: false,
      },
    );

    closeThisModal();

    $refetches.apiKeys.list = new Date();
    showToast.success({
      title: "API Key created",
      description: `The API Key "${draft.name}" has been created.`,
    });

    onCreatedApiKey(createdApiKeyRes.data.key);
  }

  async function updateApiKey(): Promise<void> {
    await apiKeysBackendDataSource.update(
      apiKeyRecord!.id,
      {
        attributes: {
          name: draft.name,
          expires_at: draft.expires_at,
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

    $refetches.apiKeys.list = new Date();
    showToast.success({
      title: "API Key updated",
      description: `The API Key "${draft.name}" has been updated.`,
    });
  }

  async function submit(): Promise<void> {
    fieldErrors = {};
    submitting = true;
    const schema: ZodSchema = newRecord ? createApiKeySchema : updateApiKeySchema;

    try {
      const validated = validateData(schema, {
        name: draft.name,
        scope_type: draft.scope_type,
        scope_value: draft.scope_value,
        permissions: draft.permissions,
        expires_at: draft.expires_at,
      });

      if (!validated.success) {
        fieldErrors = getFieldErrors(validated.error);

        submitting = false;
        return;
      }
      if (newRecord) {
        await createApiKey();
      } else {
        await updateApiKey();
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
  <ApiKeyForm {apiKey} {fieldErrors} {newRecord} onValueChange={setValue} />
</FormModal>
