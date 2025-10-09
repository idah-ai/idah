<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import DatasetForm from "@/components/app/datasets/forms/dataset-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { createDatasetSchema, updateDatasetSchema } from "@/data/model/dataset/datasets/schema";
  import { refetches } from "@/utils/refetch";
  import { getFieldErrors, validateData, type ZodSchema } from "@/utils/validate";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
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

  // Functions
  function resetForm(): void {
    fieldErrors = {};
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
  }

  async function createDataset() {
    const createdDatasetRes = await datasetsBackendDataSource.create({
      attributes: {
        name: dataset.name,
        modality: dataset.modality,
        labeling_configuration: {
          categories: [],
          properties: [],
          taggings: [],
        },
        workflow_configuration: {},
      },
      relationships: {
        project: {
          data: {
            type: "datasets:projects",
            id: projectId!,
          },
        },
      },
    });

    goto(resolve(`/projects/${projectId}/datasets/${createdDatasetRes.data.id}/tasks`));

    $refetches.datasets.list++;
    open = false;
  }

  async function updateDataset() {
    await datasetsBackendDataSource.update(dataset.id, {
      attributes: {
        name: dataset.name,
        modality: dataset.modality,
      },
    });

    $refetches.datasets.list++;
    open = false;
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
        throw new Error("Failed to submit form");
      }

      if (newRecord) {
        await createDataset();
      } else {
        await updateDataset();
      }
    } catch (error) {
      console.error(error);
      submitting = false;
    }
  }
</script>

<FormModal {action} {title} loading={submitting} onCancel={resetForm} onConfirm={submit} bind:open>
  <DatasetForm {dataset} {fieldErrors} {newRecord} onValueChange={setValue}></DatasetForm>
</FormModal>
