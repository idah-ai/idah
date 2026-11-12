<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { authStatus } from "@/security/AuthContext";
  import { onMount } from "svelte";

  import DatasetForm from "@/components/app/datasets/forms/dataset-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

  import { FormChangeTracker } from "@/utils/form/form-change-tracker.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { resourcePath } from "@/data/BackendDataSource";
  import { clearCache } from "@/data/Cache";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import {
    createDatasetSchema,
    deliveryDateChangeSchema,
    updateDatasetSchema,
  } from "@/data/model/dataset/datasets/schema";
  import { entriesBasePath } from "@/data/model/dataset/entries/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { getFieldErrors, validateData, type ZodSchema } from "@/utils/validate";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { IConfig } from "@/plugin/v2/types";
  import type { ProjectMemberScope } from "@/security/types";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    datasetRecord?: DatasetRecord;
  }
  let { action, open = $bindable(), title, datasetRecord }: Props = $props();

  let canEditDeliveryDate = $state(false);
  onMount(async () => {
    const currentAccount = $authStatus.authContext;
    if (!projectId) return;
    const as_project_owner: { as_user: ProjectMemberScope } = {
      as_user: { projectId, projectMemberRoles: ["project_owner"] },
    };
    canEditDeliveryDate =
      (await currentAccount?.can("update", "dataset:datasets", ["as_org_owner", as_project_owner])) || false;
  });

  // Variables
  let projectId: string | undefined = $derived(page.params.projectId);
  let newRecord: boolean = $derived(action === "create");
  let fieldErrors: Hash = $state({});
  let submitting: boolean = $state(false);
  let selectedDatasetId = $state<string | null>(null);

  // Read-only seed for <DatasetForm>; never mutated here.
  let dataset: DatasetRecord = $derived(
    datasetRecord
      ? datasetRecord
      : new DatasetRecord({
          type: "datasets:datasets",
          attributes: {
            name: null,
            description: null,
            delivery_date: null,
          },
        }),
  );
  // Local edit buffer holding the current form values.
  let draft: Hash = $state({});

  // Single source of truth for the dirty comparison. Keys MUST be limited to
  // fields the form emits via onValueChange — used for BOTH the original-record
  // and current-value snapshots. The copy-from source (selectedDatasetId) is
  // not a DatasetRecord field, so it is tracked separately below, not here.
  function serializeEditableFields(source: Hash): Hash {
    return {
      name: source.name,
      modality: source.modality,
      delivery_date: source.delivery_date ?? null,
    };
  }
  const changeTracker = new FormChangeTracker(serializeEditableFields, () => datasetRecord);
  // A "Copy label configurations from" selection is a change on its own (the
  // select can't be cleared, so there is no revert-to-none for it). Composed
  // with changeTracker.hasUnsavedChanges in the FormModal disabled binding.
  let hasCopyLabelConfigSelected: boolean = $derived(!!selectedDatasetId);

  // Functions
  function resetForm(): void {
    fieldErrors = {};
    changeTracker.reset();
    selectedDatasetId = null;
    draft = {};
  }

  function setValue(value: Hash): void {
    draft = { ...value };
    selectedDatasetId = value.selectedDatasetId;
    changeTracker.update(value);
  }

  async function getLabelConfig() {
    let labelConfig: IConfig = {};
    let selectedId = selectedDatasetId || (datasetRecord?.id as string);

    if (!selectedId) return labelConfig;

    const datasetRes = await datasetsBackendDataSource.get(selectedId, {
      fields: {
        [DatasetRecord.type]: ["labeling_configuration"],
      },
      noCache: true,
    });

    labelConfig = datasetRes.data.labeling_configuration;

    return labelConfig;
  }

  async function createDataset() {
    const labelConfig = await getLabelConfig();

    const createdDatasetRes = await datasetsBackendDataSource.create(
      {
        attributes: {
          name: draft.name,
          modality: draft.modality,
          ...(canEditDeliveryDate && draft.delivery_date ? { delivery_date: draft.delivery_date } : {}),
          labeling_configuration: labelConfig,
          workflow_configuration: {},
        },
        relationships: {
          project: {
            data: {
              type: ProjectRecord.type,
              id: projectId!,
            },
          },
        },
      },
      {
        showErrorToast: false,
      },
    );

    open = false;
    $refetches.datasets.list = new Date();
    goto(resolve(`/projects/${projectId}/datasets/${createdDatasetRes.data.id}/entries`));
    showToast.success({
      title: "Dataset created",
      description: `The dataset "${draft.name}" has been created.`,
    });
  }

  async function updateDataset(): Promise<void> {
    const labelConfig = await getLabelConfig();
    const deliveryDateChanged =
      canEditDeliveryDate && (draft.delivery_date ?? null) !== (datasetRecord?.delivery_date ?? null);

    await datasetsBackendDataSource.update(
      datasetRecord!.id,
      {
        attributes: {
          name: draft.name,
          modality: draft.modality,
          ...(deliveryDateChanged ? { delivery_date: draft.delivery_date ?? null } : {}),
          labeling_configuration: labelConfig,
        },
      },
      {
        showErrorToast: false,
      },
    );

    if (deliveryDateChanged) {
      clearCache(resourcePath(entriesBasePath, null, undefined));
      $refetches.entries.list = new Date();
    }
    open = false;
    $refetches.datasets.list = new Date();
    $refetches.datasets.get = new Date();
    showToast.success({
      title: "Dataset updated",
      description: `The dataset "${draft.name}" has been updated.`,
    });
  }

  async function submit(): Promise<void> {
    fieldErrors = {};
    submitting = true;
    const schema: ZodSchema = newRecord ? createDatasetSchema : updateDatasetSchema;

    try {
      const dateValidation = deliveryDateChangeSchema.safeParse({
        delivery_date: canEditDeliveryDate ? draft.delivery_date : undefined,
        original_delivery_date: datasetRecord?.delivery_date ?? null,
      });
      if (!dateValidation.success) {
        fieldErrors = getFieldErrors(dateValidation.error);
        return;
      }
      const validated = validateData(schema, {
        name: draft.name,
        modality: draft.modality,
        delivery_date: draft.delivery_date,
      });

      if (!validated.success) {
        fieldErrors = getFieldErrors(validated.error);
        submitting = false;
        return;
      }

      if (newRecord) {
        await createDataset();
      } else {
        await updateDataset();
      }
    } catch (error) {
      submitting = false;
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
  disabled={action === "update" ? !(changeTracker.hasUnsavedChanges || hasCopyLabelConfigSelected) : false}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  <DatasetForm {dataset} {fieldErrors} {newRecord} {canEditDeliveryDate} onValueChange={setValue}></DatasetForm>
</FormModal>
