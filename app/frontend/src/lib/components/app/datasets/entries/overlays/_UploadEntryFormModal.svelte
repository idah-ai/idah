<script lang="ts">
  import { page } from "$app/state";
  import { getLocalTimeZone, parseDate, today } from "@internationalized/date";

  import DatePickerField from "@/components/app/forms/fields/picker/date-picker-field.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Checkbox } from "@/components/ui/checkbox";
  import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
  import Text from "@/components/ui/text/Text.svelte";

  import MediaPicker from "@/components/app/datasets/upload/MediaPicker.svelte";
  import UploadKeepOpenNote from "@/components/app/datasets/upload/UploadKeepOpenNote.svelte";
  import UploadMediaItem from "@/components/app/datasets/upload/UploadMediaItem.svelte";

  import {
    buildEntryRows,
    createdEntryNames,
    problemsFirst,
    rowItems,
    rowView,
  } from "@/components/app/datasets/upload/upload-rows";
  import { MAX_RETRIES, showUploadSummaryToast, uploadAll } from "@/components/app/datasets/upload/upload-pipeline";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { resourcePath } from "@/data/BackendDataSource";
  import { clearCache } from "@/data/Cache";
  import { datasetBasePath } from "@/data/model/dataset/dataset-record";
  import { deliveryDateChangeSchema } from "@/data/model/dataset/datasets/schema";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { selectionSummary } from "@/components/app/datasets/upload/upload-summary";
  import { guardLeavingDuringUpload } from "@/components/app/datasets/upload/upload-leave-guard.svelte";
  import { refetches } from "@/utils/refetch";
  import { pluralizeUnit } from "@/utils/unit";
  import { getFieldErrors } from "@/utils/validate";

  import type { UploadRow } from "@/components/app/datasets/upload/upload-rows";
  import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";
  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

  // Props
  interface CreateEntryFormModalProps extends FormModalBaseProps {
    modality: string;
    canEditDeliveryDate: boolean;
    datasetDeliveryDate: string | null;
  }
  let {
    action,
    title,
    open = $bindable(),
    modality,
    canEditDeliveryDate,
    datasetDeliveryDate,
  }: CreateEntryFormModalProps = $props();

  let sameAsDatasetDeliveryDate = $state(true);
  let selectedDeliveryDate = $state<string | null>(null);
  let dateErrors = $state<string[]>([]);
  let displayedDeliveryDate = $derived(sameAsDatasetDeliveryDate ? datasetDeliveryDate : selectedDeliveryDate);

  // Types
  interface View {
    current: "select" | "upload";
    isSelect(): boolean;
    isUpload(): boolean;
  }

  // Variables
  let newRecord: boolean = $derived(action === "create");

  let projectId = page.params.projectId as string;
  let datasetId = page.params.datasetId as string;

  let view = $state<View>({
    current: "select",
    isSelect(): boolean {
      return this.current === "select";
    },
    isUpload(): boolean {
      return this.current === "upload";
    },
  });

  let picked = $state<PickedFile[]>([]);
  let createdEntries = false; // refresh the entries list once the modal closes

  // Summary rows: loose files and zips, and each picked folder summed up like a zip.
  let rows = $state<UploadRow[]>([]);
  const allItemsCompleted = $derived(rows.length > 0 && rows.every((row) => rowView(row).status === "completed"));
  // Once done, failed and skipped files come first: a long list shows its problems without scrolling.
  const listedRows = $derived(allItemsCompleted ? problemsFirst(rows) : rows);
  const uploadProgressText = $derived.by<string>(() => {
    const done = rows.filter((row) => rowView(row).status === "completed").length;
    return `${done} of ${rows.length} ${pluralizeUnit(rows.length, "item")} uploaded`;
  });

  let uploading: boolean = $state(false);
  guardLeavingDuringUpload(() => uploading);
  let disabledUploadButton: boolean = $derived.by(() => {
    if (picked.length === 0) return true;

    if (uploading) return true;

    return false;
  });

  // Functions
  // New entries change the dataset's counts and progress too.
  function refetchEntriesAndDatasets(): void {
    clearCache(resourcePath(datasetBasePath, null, undefined));
    $refetches.entries.list = new Date();
    $refetches.datasets.list = new Date();
  }

  function resetForm(): void {
    // Refresh on close, not right after upload: this modal can be opened from the empty
    // state, which the refreshed list removes (and the open summary with it).
    if (createdEntries) refetchEntriesAndDatasets();
    createdEntries = false;
    sameAsDatasetDeliveryDate = true;
    selectedDeliveryDate = null;
    dateErrors = [];
    uploading = false;
    picked = [];
    rows = [];
    view.current = "select";
  }

  async function uploadMedia(): Promise<void> {
    if (picked.length === 0) {
      showToast.error({ title: "No media selected for upload." });
      return;
    }

    rows = buildEntryRows(picked);

    await uploadAll(rowItems(rows), {
      projectId,
      modality,
      getDatasetId: async () => datasetId,
      deliveryDate: canEditDeliveryDate && !sameAsDatasetDeliveryDate ? selectedDeliveryDate : undefined,
    });

    if (showUploadSummaryToast(rows.map(rowView)) > 0) {
      createdEntries = true;
    }
  }

  async function submit(): Promise<void> {
    // FormModal also submits on Enter: never start again while running or on the summary.
    if (uploading || view.isUpload()) return;
    if (canEditDeliveryDate && !sameAsDatasetDeliveryDate && !selectedDeliveryDate) {
      dateErrors = ["Select a Delivery Date or use the Dataset delivery date."];
      return;
    }
    uploading = true;
    dateErrors = [];
    try {
      if (canEditDeliveryDate && !sameAsDatasetDeliveryDate && selectedDeliveryDate) {
        const result = deliveryDateChangeSchema.safeParse({ delivery_date: selectedDeliveryDate });
        if (!result.success) {
          dateErrors = (getFieldErrors(result.error) as { delivery_date?: string[] }).delivery_date ?? [];
          return;
        }
      }
      view.current = "upload";
      await uploadMedia();
    } catch (error) {
      showActionFailedToast(error);
    } finally {
      uploading = false;
    }
  }
</script>

<FormModal
  {action}
  {title}
  description="Import media from your computer"
  loading={uploading}
  closeOnOutsideClick={false}
  preventClose={uploading}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  {#snippet modalTitle()}
    {#if view.isSelect()}
      <DialogTitle>{newRecord ? `Add New ${title}` : `Edit ${title}`}</DialogTitle>
    {:else if allItemsCompleted}
      <DialogTitle>Upload completed</DialogTitle>
    {:else}
      <DialogTitle>Uploading media...</DialogTitle>
    {/if}
  {/snippet}

  {#snippet modalDescription()}
    {#if view.isSelect()}
      <DialogDescription>Import media from your computer</DialogDescription>
    {:else if !allItemsCompleted}
      <UploadKeepOpenNote />
    {/if}
  {/snippet}

  {#if view.isSelect()}
    <MediaPicker bind:picked />
    {#if canEditDeliveryDate}
      <section class="mt-4 flex flex-col gap-2">
        {#key displayedDeliveryDate}
          <DatePickerField
            name="upload/delivery_date"
            label="Delivery Date"
            placeholder="Select delivery date"
            required={!sameAsDatasetDeliveryDate}
            value={displayedDeliveryDate ? parseDate(displayedDeliveryDate).toDate(getLocalTimeZone()) : null}
            minDate={today(getLocalTimeZone())}
            disabled={uploading || sameAsDatasetDeliveryDate}
            clearable={!sameAsDatasetDeliveryDate}
            errors={dateErrors}
            onDateSelected={(date) => {
              selectedDeliveryDate = date;
              dateErrors = [];
            }}
          />
        {/key}
        <div class="flex items-center gap-2">
          <Checkbox
            id="upload-same-as-dataset-delivery-date"
            checked={sameAsDatasetDeliveryDate}
            disabled={uploading}
            onCheckedChange={(checked) => {
              sameAsDatasetDeliveryDate = checked;
              selectedDeliveryDate = null;
              dateErrors = [];
            }}
          />
          <Text size="sm" class="text-muted-foreground">Same as dataset delivery date</Text>
        </div>
      </section>
    {/if}
  {/if}

  {#if view.isUpload()}
    <section class="max-h-[50vh] divide-y overflow-y-auto rounded-lg border">
      {#each listedRows as row, rowIndex (rowIndex)}
        <UploadMediaItem uploadItem={rowView(row)} maxRetries={MAX_RETRIES} entries={createdEntryNames(row)} />
      {/each}
    </section>
  {/if}

  {#snippet actions()}
    <section class="flex w-full items-center">
      <Text>
        {#if view.isSelect()}
          <DialogDescription>{selectionSummary(picked.length, "item", "to upload")}</DialogDescription>
        {/if}

        {#if view.isUpload() && !allItemsCompleted}
          <DialogDescription>
            {uploadProgressText}
          </DialogDescription>
        {/if}
      </Text>

      {#if view.isUpload() && allItemsCompleted}
        <DialogClose class="ml-auto">
          <Button onclick={resetForm}>Close</Button>
        </DialogClose>
      {/if}

      {#if view.isSelect()}
        <div class="ml-auto flex items-center gap-2">
          <DialogClose>
            <Button variant="outline" class="w-full lg:w-auto" onclick={resetForm}>Cancel</Button>
          </DialogClose>

          <Button loading={uploading} loadingLabel="Uploading" disabled={disabledUploadButton} onclick={submit}>
            Upload
          </Button>
        </div>
      {/if}
    </section>
  {/snippet}
</FormModal>
