<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import UploadMediaItem from "@/components/app/datasets/entries/overlays/_UploadMediaItem.svelte";
  import DatasetForm from "@/components/app/datasets/forms/dataset-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import { DialogDescription, DialogTitle } from "@/components/ui/dialog";

  import { FormChangeTracker } from "@/utils/form/form-change-tracker.svelte";

  import { createUploadItem, type UploadItem } from "@/components/app/datasets/entries/overlays/upload-item.types";
  import {
    MAX_RETRIES,
    once,
    showUploadSummaryToast,
    uploadAll,
  } from "@/components/app/datasets/entries/overlays/upload-pipeline";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { createDatasetSchema, updateDatasetSchema } from "@/data/model/dataset/datasets/schema";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { pluralizeUnit } from "@/utils/unit";
  import { getFieldErrors, validateData, type ZodSchema } from "@/utils/validate";

  import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";
  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { IConfig } from "@/plugin/v2/types";
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
  // Set while creating the dataset from a folder/zip upload.
  let uploadItems = $state<UploadItem[]>([]);
  const uploadProgressText = $derived.by<string>(() => {
    const done = uploadItems.filter((i) => i.status === "completed").length;
    return `${done} of ${uploadItems.length} ${pluralizeUnit(uploadItems.length, "item")} uploaded`;
  });

  // Read-only seed for <DatasetForm>; never mutated here.
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
    uploadItems = [];
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

  async function createDataset(): Promise<string> {
    const labelConfig = await getLabelConfig();

    const createdDatasetRes = await datasetsBackendDataSource.create(
      {
        attributes: {
          name: draft.name,
          modality: draft.modality,
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

    return createdDatasetRes.data.id;
  }

  function openDataset(datasetId: string): void {
    open = false;
    $refetches.datasets.list = new Date();
    goto(resolve(`/projects/${projectId}/datasets/${datasetId}/entries`));
  }

  // The dataset is only created once an upload actually produced media, so an
  // empty/unsupported/corrupt selection never leaves an empty dataset behind.
  async function createDatasetFromUpload(): Promise<void> {
    let datasetId: string | null = null;
    const createOnce = once(async () => (datasetId = await createDataset()));

    uploadItems = (draft.picked as PickedFile[]).map(({ file }) => createUploadItem(file));
    await uploadAll(uploadItems, { projectId: projectId!, modality: draft.modality, getDatasetId: createOnce });

    if (!datasetId) {
      uploadItems = []; // back to the form so the user can pick other files
      submitting = false;
      showToast.error({ title: "No supported files found", description: "The dataset was not created." });
      return;
    }

    showUploadSummaryToast(uploadItems);
    openDataset(datasetId);
  }

  async function updateDataset() {
    const labelConfig = await getLabelConfig();

    await datasetsBackendDataSource.update(
      datasetRecord!.id,
      {
        attributes: {
          name: draft.name,
          modality: draft.modality,
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
      description: `The dataset "${draft.name}" has been updated.`,
    });
  }

  async function submit(): Promise<void> {
    fieldErrors = {};
    submitting = true;
    const schema: ZodSchema = newRecord ? createDatasetSchema : updateDatasetSchema;

    try {
      const validated = validateData(schema, {
        name: draft.name,
        modality: draft.modality,
      });

      if (!validated.success) {
        fieldErrors = getFieldErrors(validated.error);
        submitting = false;
        return;
      }

      if (newRecord && draft.uploadNow) {
        if (!draft.picked?.length) {
          fieldErrors = { files: ["Select a folder or files to upload"] };
          submitting = false;
          return;
        }
        await createDatasetFromUpload();
      } else if (newRecord) {
        openDataset(await createDataset());
        showToast.success({
          title: "Dataset created",
          description: `The dataset "${draft.name}" has been created.`,
        });
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
  disabled={action === "update" ? !(changeTracker.hasUnsavedChanges || hasCopyLabelConfigSelected) : false}
  onCancel={resetForm}
  onConfirm={submit}
  closeOnOutsideClick={uploadItems.length === 0}
  actions={uploadItems.length > 0 ? uploadingActions : undefined}
  bind:open
>
  {#snippet modalTitle()}
    {#if uploadItems.length > 0}
      <DialogTitle>Creating dataset from upload...</DialogTitle>
    {:else}
      <DialogTitle>{newRecord ? `Add New ${title}` : `Edit ${title}`}</DialogTitle>
    {/if}
  {/snippet}

  {#snippet modalDescription()}
    <DialogDescription>{uploadItems.length > 0 ? uploadProgressText : ""}</DialogDescription>
  {/snippet}

  {#if uploadItems.length > 0}
    <section class="flex h-auto max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
      {#each uploadItems as uploadItem, uploadItemIndex (uploadItemIndex)}
        <UploadMediaItem {uploadItem} maxRetries={MAX_RETRIES} />
      {/each}
    </section>
  {/if}

  <!-- Hidden, not unmounted, during upload: the form keeps its values if nothing gets imported. -->
  <div class:hidden={uploadItems.length > 0}>
    <DatasetForm {dataset} {fieldErrors} {newRecord} onValueChange={setValue}></DatasetForm>
  </div>
</FormModal>

<!-- No Cancel while uploading: the upload would keep running behind a closed modal. -->
{#snippet uploadingActions()}
  <DialogDescription>Please keep this window open until the upload finishes.</DialogDescription>
{/snippet}
