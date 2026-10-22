<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import UploadMediaItem from "@/components/app/datasets/upload/upload-media-item.svelte";
  import DatasetForm from "@/components/app/datasets/forms/dataset-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
  import Text from "@/components/ui/text/Text.svelte";
  import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

  import { FormChangeTracker } from "@/utils/form/form-change-tracker.svelte";

  import { groupIntoDatasets } from "@/components/app/datasets/upload/dataset-groups";
  import { selectionSummary } from "@/components/app/datasets/upload/upload-summary";
  import { createUploadItem } from "@/components/app/datasets/upload/upload-item.types";
  import {
    assignIgnored,
    looseRow,
    folderRow,
    rowItems,
    rowView,
    type UploadRow,
  } from "@/components/app/datasets/upload/upload-rows";
  import {
    MAX_RETRIES,
    once,
    showUploadSummaryToast,
    uploadAll,
  } from "@/components/app/datasets/upload/upload-pipeline";
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
  // Create mode: an empty dataset, or datasets created from folders/zips.
  let createMode = $state<"empty" | "upload">("empty");
  let uploadMode: boolean = $derived(newRecord && createMode === "upload");

  // One run per dataset to create; set from submit until the modal is closed.
  interface UploadRun {
    name: string;
    rows: UploadRow[]; // the dataset's zip, or its folder summed up like a zip
    datasetId: string | null;
    // Report-only sections (nothing to upload): a folder where every file was skipped, or loose files.
    reportOnly?: "folder" | "loose";
  }
  let runs = $state<UploadRun[]>([]);
  let createdDatasets = false; // refresh the datasets list once the modal closes
  let uploading: boolean = $derived(runs.length > 0);
  const allRows: UploadRow[] = $derived(runs.flatMap((run) => run.rows));
  const allRunsCompleted: boolean = $derived(uploading && allRows.every((row) => rowView(row).status === "completed"));
  const uploadProgressText = $derived.by<string>(() => {
    const done = allRows.filter((row) => rowView(row).status === "completed").length;
    return `${done} of ${allRows.length} ${pluralizeUnit(allRows.length, "item")} uploaded`;
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
  const datasetsToCreate: number = $derived(
    uploadMode ? groupIntoDatasets((draft.picked as PickedFile[] | undefined) ?? []).groups.length : 0,
  );

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
    // Refresh on close, not right after upload: the datasets table is rebuilt on refresh
    // and may hold the button this modal lives in (and the open summary with it).
    if (createdDatasets) $refetches.datasets.list = new Date();
    createdDatasets = false;
    fieldErrors = {};
    changeTracker.reset();
    selectedDatasetId = null;
    draft = {};
    runs = [];
    createMode = "empty";
    submitting = false;
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

  async function createDataset(name: string, labelConfig: IConfig): Promise<string> {
    const createdDatasetRes = await datasetsBackendDataSource.create(
      {
        attributes: {
          name,
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

  // Each dataset is only created once one of its files actually produced media, so an
  // empty/unsupported/corrupt folder or zip never leaves an empty dataset behind.
  async function createDatasetsFromUpload(): Promise<void> {
    const { groups } = groupIntoDatasets(draft.picked as PickedFile[]);
    if (groups.length === 0) {
      fieldErrors = { files: ["Select at least one folder or zip file"] };
      return;
    }

    // One fetch shared by every dataset, so they all get the same copied configuration.
    const labelConfig = once(getLabelConfig);
    const { byGroup, skippedGroups, loose } = assignIgnored(groups, (draft.ignored as PickedFile[] | undefined) ?? []);
    runs = groups.map((group) => {
      const isZip = group.files.length === 1 && !group.files[0].path.includes("/");
      const row: UploadRow = isZip
        ? { kind: "file", item: createUploadItem(group.files[0].file) }
        : folderRow(group.name, group.files, byGroup.get(group.key) ?? []);
      return { name: group.name, rows: [row], datasetId: null };
    });
    for (const group of skippedGroups) {
      runs.push({
        name: group.name,
        rows: [folderRow(group.name, [], group.files)],
        datasetId: null,
        reportOnly: "folder",
      });
    }
    if (loose.length > 0) {
      runs.push({ name: "Loose files", rows: [looseRow(loose)], datasetId: null, reportOnly: "loose" });
    }

    for (const run of runs) {
      await uploadAll(rowItems(run.rows), {
        projectId: projectId!,
        modality: draft.modality,
        getDatasetId: once(async () => (run.datasetId = await createDataset(run.name, await labelConfig()))),
      });
    }

    // Like Add Entry, the modal stays open on the summary; the user closes it.
    const created = runs.filter((run) => run.datasetId).length;
    if (created === 0) {
      showToast.error({ title: "No datasets created", description: "No supported files could be uploaded." });
      return;
    }

    showUploadSummaryToast(allRows.map(rowView), created);
    createdDatasets = true;
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
    // Upload mode names datasets after the folders/zips, so only the modality is validated.
    const schema: ZodSchema = uploadMode
      ? createDatasetSchema.pick({ modality: true })
      : newRecord
        ? createDatasetSchema
        : updateDatasetSchema;

    try {
      const validated = validateData(schema, {
        name: draft.name,
        modality: draft.modality,
      });

      if (!validated.success) {
        fieldErrors = getFieldErrors(validated.error);
        return;
      }

      if (uploadMode) {
        await createDatasetsFromUpload();
      } else if (newRecord) {
        openDataset(await createDataset(draft.name, await getLabelConfig()));
        showToast.success({
          title: "Dataset created",
          description: `The dataset "${draft.name}" has been created.`,
        });
      } else {
        await updateDataset();
      }
    } catch (error) {
      showActionFailedToast(error);
    } finally {
      submitting = false; // success paths included: the modal may stay mounted for the next open
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
  closeOnOutsideClick={!uploading}
  actions={uploading ? progressActions : newRecord ? createActions : undefined}
  bind:open
>
  {#snippet modalTitle()}
    {#if allRunsCompleted}
      <DialogTitle>Upload completed</DialogTitle>
    {:else if uploading}
      <DialogTitle>Creating datasets from upload...</DialogTitle>
    {:else}
      <DialogTitle>{newRecord ? `Add New ${title}` : `Edit ${title}`}</DialogTitle>
    {/if}
  {/snippet}

  {#snippet modalDescription()}
    <DialogDescription></DialogDescription>
  {/snippet}

  {#if uploading}
    <section class="flex h-auto max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
      {#each runs as run, runIndex (runIndex)}
        {@const runCompleted = run.rows.every((row) => rowView(row).status === "completed")}
        <h3 class="text-sm font-semibold">
          {run.name}
          {#if run.datasetId}
            <span class="text-muted-foreground font-normal">· created</span>
          {:else if run.reportOnly === "loose"}
            <span class="text-muted-foreground font-normal">· not in a folder or zip</span>
          {:else if runCompleted}
            <span class="text-destructive font-normal">· not created</span>
          {/if}
        </h3>
        {#each run.rows as row, rowIndex (rowIndex)}
          <UploadMediaItem uploadItem={rowView(row)} maxRetries={MAX_RETRIES} />
        {/each}
      {/each}
    </section>
  {:else}
    {#if newRecord}
      <Tabs
        class="mb-4 px-1"
        value={createMode}
        onValueChange={(value) => {
          createMode = value as "empty" | "upload";
          fieldErrors = {};
        }}
      >
        <TabsList class="w-full">
          <TabsTrigger value="empty">Empty dataset</TabsTrigger>
          <TabsTrigger value="upload">From upload</TabsTrigger>
        </TabsList>
      </Tabs>
    {/if}

    <DatasetForm {dataset} {fieldErrors} {newRecord} {uploadMode} onValueChange={setValue}></DatasetForm>
  {/if}
</FormModal>

<!-- Same layout as Add Entry: selection summary on the left, buttons on the right. -->
{#snippet createActions()}
  <section class="flex w-full items-center">
    <Text>
      {#if uploadMode}
        <DialogDescription>
          {selectionSummary(datasetsToCreate, "dataset", "to create", draft.ignored?.length ?? 0)}
        </DialogDescription>
      {/if}
    </Text>

    <div class="ml-auto flex items-center gap-2">
      <DialogClose>
        <Button variant="outline" class="w-full lg:w-auto" onclick={resetForm}>Cancel</Button>
      </DialogClose>

      <Button loading={submitting} loadingLabel="Creating" onclick={submit}>
        {uploadMode && datasetsToCreate > 1 ? `Create ${datasetsToCreate} Datasets` : `Create ${title}`}
      </Button>
    </div>
  </section>
{/snippet}

<!-- Same as Add Entry: progress only, no Cancel (the upload would keep running behind a closed modal). -->
{#snippet progressActions()}
  <DialogDescription>{uploadProgressText}</DialogDescription>
{/snippet}
