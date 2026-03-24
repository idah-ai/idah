<script lang="ts">
  import ApiKeyForm from "@/components/app/iam/api-keys/forms/api-key-form.svelte";
  import ApiKeyGeneratedModal from "@/components/app/iam/api-keys/overlays/api-key-generated-modal.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

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
  }
  let { action, open = $bindable(), title, apiKeyRecord }: Props = $props();

  // Variables
  let newRecord: boolean = $derived(action === "create");
  let fieldErrors: Hash = $state({});
  let submitting: boolean = $state(false);
  let openApiKeyGeneratedModal: boolean = $state(false);
  let keyValue: string = $state("");

  let apiKey: ApiKeyRecord = $derived(
    apiKeyRecord
      ? apiKeyRecord
      : new ApiKeyRecord({
          type: ApiKeyRecord.type,
          attributes: {
            name: null,
            scope_type: "all",
            scope_value: [],
            permissions: [],
            expires_at: null,
          },
        }),
  );

  // Functions
  function closeThisModal(): void {
    open = false;
  }

  function resetForm(): void {
    fieldErrors = {};
    apiKey = new ApiKeyRecord({
      type: ApiKeyRecord.type,
      attributes: {
        name: null,
        scope_type: "all",
        scope_value: [],
        permissions: [],
        expires_at: null,
      },
    });
  }

  function setValue(value: Hash): void {
    apiKey.name = value.name;
    apiKey.scope_type = value.scope_type;
    apiKey.scope_value = value.scope_value;
    apiKey.permissions = value.permissions;
    apiKey.expires_at = value.expires_at;
    apiKey.key = value.key;
  }

  async function createApiKey(): Promise<void> {
    const response = await apiKeysBackendDataSource.create(
      {
        attributes: {
          name: apiKey.name,
          scope_type: apiKey.scope_type,
          scope_value: apiKey.scope_value || [],
          permissions: apiKey.permissions || [],
          expires_at: apiKey.expires_at,
        },
      },
      {
        showErrorToast: false,
      },
    );

    keyValue = response.data.key;

    closeThisModal();
    openApiKeyGeneratedModal = true;
    $refetches.apiKeys.list = new Date();
    showToast.success({
      title: "API Key created",
      description: `The API Key "${apiKey.name}" has been created.`,
    });
  }

  async function updateApiKey(): Promise<void> {
    console.log({ apiKey });

    await apiKeysBackendDataSource.update(
      apiKey.id,
      {
        attributes: {
          name: apiKey.name,
          expires_at: apiKey.expires_at,
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
      description: `The API Key "${apiKey.name}" has been updated.`,
    });
  }

  async function submit(): Promise<void> {
    fieldErrors = {};
    submitting = true;
    const schema: ZodSchema = newRecord ? createApiKeySchema : updateApiKeySchema;

    try {
      const validated = validateData(schema, {
        name: apiKey.name,
        scope_type: apiKey.scope_type,
        scope_value: apiKey.scope_value,
        permissions: apiKey.permissions,
        expires_at: apiKey.expires_at,
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

<FormModal {action} {title} loading={submitting} onCancel={resetForm} onConfirm={submit} bind:open>
  <ApiKeyForm {apiKey} {fieldErrors} {newRecord} onValueChange={setValue} />
</FormModal>

<ApiKeyGeneratedModal value={keyValue} bind:open={openApiKeyGeneratedModal} />
