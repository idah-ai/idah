<script lang="ts">
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import StorageTargetForm from "@/components/app/storage-targets/forms/storage-target-form.svelte";

  import { FormChangeTracker } from "@/utils/form/form-change-tracker.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { StorageTargetRecord, storageTargetsBackendDataSource } from "@/data/model/setting/storage_target/record";
  import { createStorageTargetSchema, updateStorageTargetSchema } from "@/data/model/setting/storage_target/schema";
  import {
    secretRequiredForUpdate,
    storageTargetCreateAttributes,
    storageTargetSaveErrorMessage,
    storageTargetUpdateAttributes,
  } from "@/data/model/setting/storage_target/utils";
  import { refetches } from "@/utils/refetch";
  import { getFieldErrors, validateData } from "@/utils/validate";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    targetRecord?: StorageTargetRecord;
  }
  let { action, open = $bindable(), title, targetRecord }: Props = $props();

  // Variables
  let newRecord: boolean = $derived(action === "create");
  let fieldErrors: Hash = $state({});
  let submitting: boolean = $state(false);

  // Read-only seed for <StorageTargetForm>; never mutated here.
  let target: StorageTargetRecord = $derived(
    targetRecord
      ? targetRecord
      : new StorageTargetRecord({
          type: StorageTargetRecord.type,
          attributes: {
            name: "",
            endpoint: "",
            region: "",
            bucket: "",
            prefix: "",
            path_style: false,
            access_key_id: "",
            organization_ids: [],
            enabled: true,
          },
        }),
  );
  let draft: Hash = $state({});

  // Only what an update may change. A typed secret is a change too.
  function serializeEditableFields(source: Hash): Hash {
    return {
      name: source.name,
      path_style: Boolean(source.path_style),
      access_key_id: source.access_key_id,
      secret_access_key: source.secret_access_key ?? "",
      organization_ids: [...(source.organization_ids ?? [])].sort(),
      enabled: Boolean(source.enabled),
    };
  }
  const changeTracker = new FormChangeTracker(serializeEditableFields, () => targetRecord);

  // Functions
  function resetForm(): void {
    fieldErrors = {};
    changeTracker.reset();
    draft = {};
  }

  function setValue(value: Hash): void {
    draft = { ...value };
    changeTracker.update(value);
  }

  async function save(): Promise<void> {
    if (newRecord) {
      await storageTargetsBackendDataSource.create(
        { attributes: storageTargetCreateAttributes(draft) },
        { showErrorToast: false },
      );
    } else {
      await storageTargetsBackendDataSource.update(
        targetRecord!.id,
        { attributes: storageTargetUpdateAttributes(draft) },
        { showErrorToast: false },
      );
    }

    // Read before resetForm() clears the draft.
    const name = String(draft.name ?? "").trim();

    open = false;
    resetForm();
    $refetches.storageTargets.list = new Date();
    showToast.success({
      title: newRecord ? "Storage target created" : "Storage target updated",
      description: `"${name}" was tested and saved.`,
    });
  }

  async function submit(): Promise<void> {
    fieldErrors = {};

    const validated = validateData(newRecord ? createStorageTargetSchema : updateStorageTargetSchema, draft);
    if (!validated.success) {
      fieldErrors = getFieldErrors(validated.error);
      return;
    }

    if (!newRecord && secretRequiredForUpdate(draft, targetRecord!)) {
      fieldErrors = { secret_access_key: ["A new access key ID needs its secret key."] };
      return;
    }

    submitting = true;
    try {
      await save();
    } catch (error) {
      // The backend tests the connection before saving: say why it failed.
      showToast.error({ title: "Storage target not saved", description: storageTargetSaveErrorMessage(error) });
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal
  {action}
  {title}
  description="The connection is tested before the target is saved."
  loading={submitting}
  loadingLabel={newRecord ? "Testing and saving…" : undefined}
  disabled={action === "update" ? !changeTracker.hasUnsavedChanges : false}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  {#key target}
    <StorageTargetForm {target} {newRecord} {fieldErrors} onValueChange={setValue} />
  {/key}
</FormModal>
