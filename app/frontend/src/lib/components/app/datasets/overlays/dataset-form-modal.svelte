<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import DatasetForm from "@/components/app/datasets/forms/dataset-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { createDatasetSchema, updateDatasetSchema } from "@/data/model/dataset/datasets/schema";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { getFieldErrors, validateData, type ZodSchema } from "@/utils/validate";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { IConfig } from "@/plugin/interface/Activity";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    datasetRecord?: DatasetRecord;
  }
  let { action, open = $bindable(), title, datasetRecord }: Props = $props();

  // Variables
  let projectId: string | undefined = $derived(page.params.projectId);
  let newRecord: boolean = $derived(action === "create");
  let fieldErrors: Hash = $state({});
  let submitting: boolean = $state(false);
  let selectedDatasetId = $state<string | null>(null);

  let dataset: DatasetRecord = $derived(
    datasetRecord
      ? datasetRecord
      : new DatasetRecord({
          type: "datasets:datasets",
          attributes: {
            name: null,
            description: null,
          },
        }),
  );

  // Dirty-state tracking (only the editable fields, fixed key order).
  function serializeEditableFields(record: DatasetRecord): Hash {
    return {
      name: record.name,
      modality: record.modality,
    };
  }
  let savedSnapshot: string = $derived(datasetRecord ? JSON.stringify(serializeEditableFields(datasetRecord)) : "");
  let editedSnapshot: string | null = $state(null);
  let hasUnsavedChanges: boolean = $derived(editedSnapshot !== null && editedSnapshot !== savedSnapshot);

  // Functions
  function resetForm(): void {
    fieldErrors = {};
    editedSnapshot = null;
    dataset = new DatasetRecord({
      type: "datasets:datasets",
      attributes: {
        name: null,
        modality: null,
      },
    });
  }

  function setValue(value: Hash): void {
    dataset.name = value.name;
    dataset.modality = value.modality;
    selectedDatasetId = value.selectedDatasetId;
    editedSnapshot = JSON.stringify({
      name: value.name,
      modality: value.modality,
    });
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
          name: dataset.name,
          modality: dataset.modality,
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
      description: `The dataset "${dataset.name}" has been created.`,
    });
  }

  async function updateDataset() {
    const labelConfig = await getLabelConfig();

    await datasetsBackendDataSource.update(
      dataset.id,
      {
        attributes: {
          name: dataset.name,
          modality: dataset.modality,
          labeling_configuration: labelConfig,
        },
      },
      {
        showErrorToast: false,
      },
    );

    open = false;
    $refetches.datasets.list = new Date();
    $refetches.datasets.get = new Date();
    showToast.success({
      title: "Dataset updated",
      description: `The dataset "${dataset.name}" has been updated.`,
    });
  }

  async function submit(): Promise<void> {
    fieldErrors = {};
    submitting = true;
    const schema: ZodSchema = newRecord ? createDatasetSchema : updateDatasetSchema;

    try {
      const validated = validateData(schema, {
        name: dataset.name,
        modality: dataset.modality,
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
  <DatasetForm {dataset} {fieldErrors} {newRecord} onValueChange={setValue}></DatasetForm>
</FormModal>
