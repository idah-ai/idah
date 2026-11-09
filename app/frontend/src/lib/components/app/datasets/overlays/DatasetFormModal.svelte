<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { onMount } from "svelte";

  import UploadMediaItem from "@/components/app/datasets/upload/UploadMediaItem.svelte";
  import DatasetForm from "@/components/app/datasets/forms/DatasetForm.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
  import Text from "@/components/ui/text/Text.svelte";
  import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

  import { FormChangeTracker } from "@/utils/form/form-change-tracker.svelte";

  import { groupIntoDatasets, type SplitOptions } from "@/components/app/datasets/upload/dataset-groups";
  import { selectionSummary } from "@/components/app/datasets/upload/upload-summary";
  import { createUploadItem } from "@/components/app/datasets/upload/upload-item.types";
  import {
    createdEntryNames,
    folderRow,
    rowItems,
    rowView,
    skippedRow,
    type UploadRow,
  } from "@/components/app/datasets/upload/upload-rows";
  import {
    MAX_RETRIES,
    once,
    showUploadSummaryToast,
    uploadAll,
  } from "@/components/app/datasets/upload/upload-pipeline";
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
  import { authStatus } from "@/security/AuthContext";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { pluralizeUnit } from "@/utils/unit";
  import { getFieldErrors, validateData, type ZodSchema } from "@/utils/validate";

  import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";
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
  // Create mode: an empty dataset, or datasets created from folders/zips.
  let createMode = $state<"empty" | "upload">("empty");
  let uploadMode: boolean = $derived(newRecord && createMode === "upload");

  // One run per dataset to create; set from submit until the modal is closed.
  interface UploadRun {
    name: string;
    rows: UploadRow[]; // the dataset's zip, or its folder summed up like a zip
    datasetId: string | null;
    leftOut?: true; // report only: the top-level files of a folder split per sub-folder
  }
  let runs = $state<UploadRun[]>([]);
  let createdDatasets = false; // refresh the datasets list once the modal closes
  let uploading: boolean = $derived(runs.length > 0);
  const allRows: UploadRow[] = $derived(runs.flatMap((run) => run.rows));
  const allRunsCompleted: boolean = $derived(uploading && allRows.every((row) => rowView(row).status === "completed"));
  const count = (n: number, unit: string, units = `${unit}s`) => `${n} ${n === 1 ? unit : units}`; // "0 entries"
  // The whole result in one line, e.g. "6 datasets and 9 entries created · 1 file skipped".
  const uploadResultText = $derived.by<string>(() => {
    const views = allRows.map(rowView);
    const datasets = runs.filter((run) => run.datasetId).length;
    const entries = views.reduce((total, view) => total + view.createdEntryCount, 0);
    const skipped = views.reduce((total, view) => total + view.skippedMedias.length, 0);
    const failed = views.reduce((total, view) => total + view.errorMedias.length + (view.errorMessage ? 1 : 0), 0);
    const parts = [`${count(datasets, "dataset")} and ${count(entries, "entry", "entries")} created`];
    if (skipped > 0) parts.push(`${count(skipped, "file")} skipped`);
    if (failed > 0) parts.push(`${count(failed, "file")} failed`);
    return parts.join(" · ");
  });

  // A dataset's status line once its upload finished.
  function runLabel(run: UploadRun): string {
    const view = rowView(run.rows[0]);
    if (run.leftOut) return `${count(view.skippedMedias.length, "file")} ignored`;
    const entries = count(view.createdEntryCount, "entry", "entries");
    return run.datasetId ? entries : `Not created: ${view.errorMessage ?? "no supported files"}`;
  }

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
            delivery_date: null,
          },
        }),
  );
  // Local edit buffer holding the current form values.
  let draft: Hash = $state({});
  const splitOptions: SplitOptions = $derived({
    split: new Set((draft.split as string[] | undefined) ?? []),
    looseName: draft.looseName as string | undefined,
  });
  // One dataset per picked folder or zip (or per sub-folder of a split folder), plus one for loose files.
  const datasetsToCreate: number = $derived(
    uploadMode ? groupIntoDatasets((draft.picked as PickedFile[] | undefined) ?? [], splitOptions).groups.length : 0,
  );

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
    // The selection's error ("pick something", "name the loose files") is stale once it changes.
    if (fieldErrors.files && (value.picked !== draft.picked || value.looseName !== draft.looseName)) {
      const { files: _stale, ...rest } = fieldErrors;
      fieldErrors = rest;
    }
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
    const { groups, leftOut } = groupIntoDatasets(draft.picked as PickedFile[], splitOptions);
    if (groups.length === 0) {
      fieldErrors = { files: ["Select at least one folder, zip or file"] };
      return;
    }
    if (groups.some((group) => !group.name.trim())) {
      fieldErrors = { files: ["Name the dataset for the loose files"] };
      return;
    }

    // One fetch shared by every dataset, so they all get the same copied configuration.
    const labelConfig = once(getLabelConfig);
    runs = groups.map((group) => {
      const row: UploadRow = group.isZip
        ? { kind: "file", item: createUploadItem(group.files[0].file) }
        : folderRow(group.name, group.files, group.root);
      return { name: group.name, rows: [row], datasetId: null };
    });
    for (const { name, files } of leftOut) {
      runs.push({ name, rows: [skippedRow(name, files, "Ignored, no folder")], datasetId: null, leftOut: true });
    }
    // This upload's runs, so the result below is counted on them even if `runs` is reset meanwhile.
    const current = runs;

    for (const run of current) {
      await uploadAll(rowItems(run.rows), {
        projectId: projectId!,
        modality: draft.modality,
        getDatasetId: once(async () => (run.datasetId = await createDataset(run.name, await labelConfig()))),
      });
    }

    // Like Add Entry, the modal stays open on the summary; the user closes it.
    const created = current.filter((run) => run.datasetId).length;
    if (created === 0) {
      showToast.error({ title: "No datasets created", description: "No supported files could be uploaded." });
      return;
    }

    showUploadSummaryToast(
      current.flatMap((run) => run.rows.map(rowView)),
      created,
    );
    createdDatasets = true;
  }

  async function updateDataset() {
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
    // FormModal also submits on Enter: never start again while running or on the summary.
    if (submitting || uploading) return;
    fieldErrors = {};
    submitting = true;
    // Upload mode names datasets after the folders/zips, so only the modality is validated.
    const schema: ZodSchema = uploadMode
      ? createDatasetSchema.pick({ modality: true })
      : newRecord
        ? createDatasetSchema
        : updateDatasetSchema;

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
  preventClose={submitting}
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
    <DialogDescription>{allRunsCompleted ? uploadResultText : ""}</DialogDescription>
  {/snippet}

  {#if uploading}
    <!-- One row per dataset (a split zip: one row for all of its datasets) -->
    <section class="max-h-[60vh] divide-y overflow-y-auto rounded-lg border">
      {#each runs as run, runIndex (runIndex)}
        {#each run.rows as row, rowIndex (rowIndex)}
          <UploadMediaItem
            uploadItem={rowView(row)}
            maxRetries={MAX_RETRIES}
            title={run.name}
            label={runLabel(run)}
            warning={run.leftOut}
            entries={createdEntryNames(row)}
          />
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

    <DatasetForm {dataset} {fieldErrors} {newRecord} {uploadMode} {canEditDeliveryDate} onValueChange={setValue}
    ></DatasetForm>
  {/if}
</FormModal>

<!-- Same layout as Add Entry: selection summary on the left, buttons on the right. -->
{#snippet createActions()}
  <section class="flex w-full items-center">
    <Text>
      {#if uploadMode}
        <DialogDescription>
          {selectionSummary(datasetsToCreate, "dataset", "to create")}
        </DialogDescription>
      {/if}
    </Text>

    <div class="ml-auto flex items-center gap-2">
      <DialogClose>
        <Button variant="outline" class="w-full lg:w-auto" onclick={resetForm}>Cancel</Button>
      </DialogClose>

      <Button loading={submitting} loadingLabel="Creating" onclick={submit}>
        {uploadMode ? "Create Datasets" : `Create ${title}`}
      </Button>
    </div>
  </section>
{/snippet}

<!-- Same as Add Entry: progress only, no Cancel (the upload would keep running behind a closed modal);
     once done, the result is in the description above and the modal just closes. -->
{#snippet progressActions()}
  {#if allRunsCompleted}
    <DialogClose class="ml-auto">
      <Button onclick={resetForm}>Close</Button>
    </DialogClose>
  {:else}
    <DialogDescription>{uploadProgressText}</DialogDescription>
  {/if}
{/snippet}
