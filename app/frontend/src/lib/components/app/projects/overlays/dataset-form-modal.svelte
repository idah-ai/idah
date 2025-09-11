<script lang="ts">
  import { goto } from "$app/navigation";

  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import DatasetForm from "@/components/app/datasets/forms/dataset-form.svelte";

  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { refetches } from "@/utils/refetch";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    datasetRecord?: DatasetRecord;
  }
  let { action, open = $bindable(), title, datasetRecord }: Props = $props();

  // Variables
  let newRecord: boolean = $derived(action === "create");
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
      },
    });

    goto(`/datasets/${createdDatasetRes.data.id}`);

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
    submitting = true;

    try {
      // const validated = datasetSchema.safeParse(dataset);
      if (newRecord) {
        await createDataset();
      } else {
        await updateDataset();
      }
    } catch (error) {
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal {action} {title} loading={submitting} onCancel={resetForm} onConfirm={submit} bind:open>
  <DatasetForm {dataset} onValueChange={setValue}></DatasetForm>
</FormModal>
