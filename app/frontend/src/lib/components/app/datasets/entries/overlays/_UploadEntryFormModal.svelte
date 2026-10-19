<script lang="ts">
  import { page } from "$app/state";

  import FileUpload from "@/components/app/forms/fields/upload/file-upload.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
  import Text from "@/components/ui/text/Text.svelte";

  import PreviewUploadMediaItem from "./_PreviewUploadMediaItem.svelte";
  import UploadMediaItem from "./_UploadMediaItem.svelte";

  import { createUploadItem } from "@/components/app/datasets/entries/overlays/upload-item.types";
  import {
    acceptedFileTypes as acceptedFileTypesFor,
    MAX_RETRIES,
    showUploadSummaryToast,
    sumBy,
    uploadAll,
  } from "@/components/app/datasets/entries/overlays/upload-pipeline";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { pluralizeUnit } from "@/utils/unit";

  import type { UploadItem } from "@/components/app/datasets/entries/overlays/upload-item.types";
  import { mergePickedFiles, type PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";
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

  interface Media {
    selected: PickedFile[] | null;
    count(): number;
    any(): boolean;
  }

  interface Upload {
    items: Array<UploadItem>;
    uploadedFiles(): number;
    skippedFiles(): number;
    totalFiles(): number;
  }

  // Variables
  let newRecord: boolean = $derived(action === "create");

  const acceptedFileTypes = $derived(acceptedFileTypesFor(modality));

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

  let media = $state<Media>({
    selected: null,
    count(): number {
      return this.selected !== null ? this.selected.length : 0;
    },
    any(): boolean {
      return this.count() > 0;
    },
  });

  let upload = $state<Upload>({
    items: [],
    uploadedFiles() {
      return sumBy(this.items, (item) => item.uploadedMedias.length);
    },
    skippedFiles() {
      return sumBy(this.items, (item) => item.skippedMedias.length);
    },
    totalFiles() {
      return sumBy(this.items, (item) => item.uploadedMedias.length + item.skippedMedias.length);
    },
  });
  const allItemsCompleted = $derived(upload.items.length > 0 && upload.items.every((i) => i.status === "completed"));
  const uploadProgressText = $derived.by<string>(() => {
    const done = upload.items.filter((i) => i.status === "completed").length;
    const total = upload.items.length;
    return `${done} of ${total} ${pluralizeUnit(total, "item")} uploaded`;
  });

  let uploading: boolean = $state(false);
  let disabledUploadButton: boolean = $derived.by(() => {
    if (!media.any()) return true;

    if (uploading) return true;

    return false;
  });

  // Functions
  function resetForm(): void {
    uploading = false;
    media.selected = null;
    upload.items = [];
    view.current = "select";
  }

  function handleFilesSelected(selectedFiles: PickedFile[]): void {
    // Deduplicate to prevent accidental re-upload of the same file when a user
    // re-opens the picker and selects the same file.
    media.selected = mergePickedFiles(media.selected ?? [], selectedFiles);
  }

  function removeMedia(index: number) {
    if (!media.selected) return;
    media.selected = media.selected.filter((_, i) => i !== index);
  }

  async function uploadMedia(): Promise<void> {
    if (!media.any()) {
      showToast.error({ title: "No media selected for upload." });
      return;
    }

    upload.items = media.selected!.map(({ file }) => createUploadItem(file));

    await uploadAll(upload.items, { projectId, modality, getDatasetId: async () => datasetId });

    if (showUploadSummaryToast(upload.items) > 0) {
      $refetches.entries.list = new Date();
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
    <FileUpload class="py-12" {acceptedFileTypes} allowFolders onFilesSelected={handleFilesSelected}>
      {#snippet SelectedFilesSlot()}
        <Text class="text-accent-foreground text-wrap" size="sm">
          <span class="font-medium underline underline-offset-2">Click to select files</span>
          <span class="text-muted-foreground">or drag and drop</span>
        </Text>
      {/snippet}
    </FileUpload>

    {#if media.any()}
      <section class="mt-4 flex h-auto max-h-80 flex-col gap-4 overflow-y-auto pr-1">
        {#each media.selected as file, index (index)}
          <PreviewUploadMediaItem name={file.path} onDelete={() => removeMedia(index)} />
        {/each}
      </section>
    {/if}
  {/if}

  {#if view.isUpload()}
    <section class="flex h-auto max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
      {#each upload.items as uploadItem, uploadItemIndex (uploadItemIndex)}
        <UploadMediaItem {uploadItem} maxRetries={MAX_RETRIES} />
      {/each}
    </section>
  {/if}

  {#snippet actions()}
    <section class="flex w-full items-center">
      <Text>
        {#if view.isSelect() && media.any()}
          <DialogDescription>
            {media.count()}
            {pluralizeUnit(media.count(), "item")} to upload
          </DialogDescription>
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
