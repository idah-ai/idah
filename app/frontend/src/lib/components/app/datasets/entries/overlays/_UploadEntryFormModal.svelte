<script lang="ts">
  import { page } from "$app/state";

  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
  import Text from "@/components/ui/text/Text.svelte";

  import MediaPicker from "@/components/app/datasets/upload/media-picker.svelte";
  import UploadMediaItem from "@/components/app/datasets/upload/upload-media-item.svelte";

  import { buildEntryRows, rowItems, rowView } from "@/components/app/datasets/upload/upload-rows";
  import { MAX_RETRIES, showUploadSummaryToast, uploadAll } from "@/components/app/datasets/upload/upload-pipeline";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { resourcePath } from "@/data/BackendDataSource";
  import { clearCache } from "@/data/Cache";
  import { datasetBasePath } from "@/data/model/dataset/dataset-record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { selectionSummary } from "@/components/app/datasets/upload/upload-summary";
  import { refetches } from "@/utils/refetch";
  import { pluralizeUnit } from "@/utils/unit";

  import type { UploadRow } from "@/components/app/datasets/upload/upload-rows";
  import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";
  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

  // Props
  interface CreateEntryFormModalProps extends FormModalBaseProps {
    modality: string;
  }
  let { action, title, open = $bindable(), modality }: CreateEntryFormModalProps = $props();

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
  let ignored = $state<PickedFile[]>([]);
  let createdEntries = false; // refresh the entries list once the modal closes

  // Summary rows: loose files and zips, and each picked folder summed up like a zip.
  let rows = $state<UploadRow[]>([]);
  const allItemsCompleted = $derived(rows.length > 0 && rows.every((row) => rowView(row).status === "completed"));
  const uploadProgressText = $derived.by<string>(() => {
    const done = rows.filter((row) => rowView(row).status === "completed").length;
    return `${done} of ${rows.length} ${pluralizeUnit(rows.length, "item")} uploaded`;
  });

  let uploading: boolean = $state(false);
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
    uploading = false;
    ignored = [];
    picked = [];
    rows = [];
    view.current = "select";
  }

  async function uploadMedia(): Promise<void> {
    if (picked.length === 0) {
      showToast.error({ title: "No media selected for upload." });
      return;
    }

    rows = buildEntryRows(picked, ignored);

    await uploadAll(rowItems(rows), { projectId, modality, getDatasetId: async () => datasetId });

    if (showUploadSummaryToast(rows.map(rowView)) > 0) {
      createdEntries = true;
    }
  }

  async function submit(): Promise<void> {
    uploading = true;
    view.current = "upload";

    try {
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
    {/if}
  {/snippet}

  {#if view.isSelect()}
    <MediaPicker bind:picked bind:ignored />
  {/if}

  {#if view.isUpload()}
    <section class="flex h-auto max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
      {#each rows as row, rowIndex (rowIndex)}
        <UploadMediaItem uploadItem={rowView(row)} maxRetries={MAX_RETRIES} />
      {/each}
    </section>
  {/if}

  {#snippet actions()}
    <section class="flex w-full items-center">
      <Text>
        {#if view.isSelect()}
          <DialogDescription>{selectionSummary(picked.length, "item", "to upload", ignored.length)}</DialogDescription>
        {/if}

        {#if view.isUpload()}
          <DialogDescription>
            {uploadProgressText}
          </DialogDescription>
        {/if}
      </Text>

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
