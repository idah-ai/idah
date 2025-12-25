<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { toast } from "svelte-sonner";

  import DatasetForm from "@/components/app/datasets/forms/dataset-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { createDatasetSchema, updateDatasetSchema } from "@/data/model/dataset/datasets/schema";
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
    selectedDatasetId = value.selectedDatasetId;
  }

  async function getLabelConfig() {
    let labelConfig: IConfig = {};

    /** Get label config, if selected dataset */
    if (selectedDatasetId) {
      const datasetRes = await datasetsBackendDataSource.get(selectedDatasetId, {
        fields: {
          [DatasetRecord.type]: ["labeling_configuration"],
        },
        noCache: true,
      });
      labelConfig = datasetRes.data.labeling_configuration;
    }

    return labelConfig;
  }

  async function createDataset() {
    const labelConfig = await getLabelConfig();

    const createdDatasetRes = await datasetsBackendDataSource.create({
      attributes: {
        name: dataset.name,
        modality: dataset.modality,
        labeling_configuration: labelConfig,
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

    toast.success("Dataset created", {
      description: `The dataset ${dataset.name} has been created.`,
    });
    goto(resolve(`/projects/${projectId}/datasets/${createdDatasetRes.data.id}/entries`));

    $refetches.datasets.list = new Date();
    open = false;
  }

  async function updateDataset() {
    const labelConfig = await getLabelConfig();

    await datasetsBackendDataSource.update(dataset.id, {
      attributes: {
        name: dataset.name,
        modality: dataset.modality,
        labeling_configuration: labelConfig,
      },
    });

    toast.success("Dataset updated", {
      description: `The dataset ${dataset.name} has been updated.`,
    });
    $refetches.datasets.list = new Date();
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
        submitting = false;
        return;
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
