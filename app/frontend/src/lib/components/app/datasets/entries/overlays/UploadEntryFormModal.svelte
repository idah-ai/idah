<script lang="ts">
  import { page } from "$app/state";

  import FileUpload from "@/components/app/forms/fields/upload/file-upload.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
  import Text from "@/components/ui/text/Text.svelte";

  import PreviewUploadMediaItem from "./_PreviewUploadMediaItem.svelte";
  import UploadMediaItem from "./_UploadMediaItem.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { mediaBackendDataSource, type SkippedFile } from "@/data/model/media/medias/medias-record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { pluralizeUnit } from "@/utils/unit";

  import type { UploadItem } from "@/components/app/datasets/entries/overlays/upload-item.types";
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
    selected: File[] | null;
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

  const acceptedFileTypes = $derived.by(() => {
    switch (modality) {
      case "idah-video": {
        return [".zip", ".mp4", ".mkv", ".3gp", ".avi", ".m4v", ".mov", ".webm"];
      }
      case "idah-image": {
        return [".zip", ".jpg", ".jpeg", ".png"];
      }
      default: {
        return [];
      }
    }
  });

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

  function handleFilesSelected(selectedFiles: FileList): void {
    const newFiles = Array.from(selectedFiles);
    const existingFiles = media.selected ?? [];
    // Deduplicate on (name, size, lastModified) to prevent accidental re-upload
    // of the same file when a user re-opens the picker and selects the same file.
    const existingKeys = new Set(existingFiles.map((f) => `${f.name}|${f.size}|${f.lastModified}`));
    const uniqueNewFiles = newFiles.filter((f) => !existingKeys.has(`${f.name}|${f.size}|${f.lastModified}`));
    media.selected = [...existingFiles, ...uniqueNewFiles];
  }

  function removeMedia(index: number) {
    if (!media.selected) return;
    media.selected = media.selected.filter((_, i) => i !== index);
  }

  function getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf(".");
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : "";
  }

  const MAX_RETRIES = 3;
  const INITIAL_DELAY_MS = 2_000;
  const MAX_DELAY_MS = 30_000;

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function retryDelay(attempt: number): number {
    const base = Math.min(INITIAL_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
    const jitter = base * 0.25 * (Math.random() * 2 - 1); // ±25%
    return base + jitter;
  }

  function sumBy<T>(items: T[], fn: (item: T) => number): number {
    return items.reduce((total, item) => total + fn(item), 0);
  }

  async function uploadSingleMedia(media: UploadItem): Promise<void> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        media.status = "retrying";
        media.retryCount = attempt;
        await sleep(retryDelay(attempt - 1));
      }

      try {
        if (media.uploadedMedias.length === 0) {
          const fileExtension = getFileExtension(media.media.name);
          const resourceKey = `${media.uuid}${fileExtension}`;

          const createdMedias = await mediaBackendDataSource.upload({
            file: media.media,
            resource: resourceKey,
            projectId,
            key: "",
            modality,
          });

          if (!("data" in createdMedias)) throw new Error("Media upload failed");

          media.uploadedMedias = createdMedias.data;

          if (createdMedias.meta?.skipped) {
            for (const skippedFile of createdMedias.meta.skipped as Array<SkippedFile>) {
              media.skippedMedias.push(skippedFile);
            }
          }
        }

        for (const uploadedMedia of media.uploadedMedias.slice(media.createdEntryCount)) {
          await entriesBackendDataSource.create(
            {
              attributes: { resource: uploadedMedia.resource, name: uploadedMedia.filename, status: "pending" },
              relationships: { dataset: { data: { type: "datasets:datasets", id: datasetId } } },
            },
            { showErrorToast: false },
          );
          media.createdEntryCount++;
        }

        media.errorMessage = undefined;
        media.status = "completed";
        return; // done
      } catch (error) {
        media.errorMessage = error instanceof Error ? error.message : "Upload failed";
        if (media.isZip) {
          media.errorMedias.push({ filename: media.media.name, message: media.errorMessage });
        }
      }
    }

    media.status = "completed"; // exhausted retries, process finished
  }

  async function uploadMedia(): Promise<void> {
    if (!media.any()) {
      showToast.error({ title: "No media selected for upload." });
      return;
    }

    upload.items = media.selected!.map((media) => ({
      uuid: crypto.randomUUID().replace(/-/g, "").substring(0, 16),
      name: media.name,
      media: media,
      isZip: media.name.toLowerCase().endsWith(".zip"),
      status: "uploading",
      retryCount: 0,
      createdEntryCount: 0,
      uploadedMedias: [],
      skippedMedias: [],
      errorMedias: [],
    }));

    for (const media of upload.items) {
      await uploadSingleMedia(media); // never throws — loop always continues
    }

    const itemsWithErrors = upload.items.filter((i) => i.errorMessage).length;
    const itemsWithSkips = upload.items.filter((i) => i.skippedMedias.length > 0).length;
    const totalUploaded = sumBy(upload.items, (i) => i.uploadedMedias.length);
    const totalSkipped = sumBy(upload.items, (i) => i.skippedMedias.length);

    if (itemsWithErrors === 0 && itemsWithSkips === 0) {
      showToast.success({ title: `${totalUploaded} entries created successfully.` });
      $refetches.entries.list = new Date();
    } else if (totalUploaded > 0) {
      const parts = [`${totalUploaded} entries created`];
      if (totalSkipped > 0) parts.push(`${totalSkipped} skipped`);
      if (itemsWithErrors > 0) parts.push(`${itemsWithErrors} failed`);
      showToast.warning({ title: parts.join(", ") });
      $refetches.entries.list = new Date();
    } else {
      showToast.error({ title: "All uploads failed." });
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
      <DialogTitle>Uploaded</DialogTitle>
    {:else}
      <DialogTitle>Uploading media...</DialogTitle>
    {/if}
  {/snippet}

  {#snippet modalDescription()}
    {#if view.isSelect()}
      <DialogDescription>Import media from your computer</DialogDescription>
    {:else}
      <DialogDescription>
        {uploadProgressText}
      </DialogDescription>
    {/if}
  {/snippet}

  {#if view.isSelect()}
    <FileUpload class="py-12" {acceptedFileTypes} onFilesSelected={handleFilesSelected}>
      {#snippet SelectedFilesSlot()}
        <Text class="text-accent-foreground text-wrap" size="sm">
          <span class="font-medium underline underline-offset-2">Click to select files</span>
          <span class="text-muted-foreground">or drag and drop</span>
        </Text>
      {/snippet}
    </FileUpload>

    {#if media.any()}
      <section class="mt-4 flex h-80 flex-col gap-4 overflow-y-auto pr-1">
        {#each media.selected as file, index (index)}
          <PreviewUploadMediaItem name={file.name} onDelete={() => removeMedia(index)} />
        {/each}
      </section>
    {/if}
  {/if}

  {#if view.isUpload()}
    <section class="flex h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
      {#each upload.items as uploadItem, uploadItemIndex (uploadItemIndex)}
        <UploadMediaItem {uploadItem} maxRetries={MAX_RETRIES} />
      {/each}
    </section>
  {/if}

  {#snippet actions()}
    <section class="flex w-full items-center">
      <Text>
        {#if view.isSelect() && media.any()}
          {media.count()} {pluralizeUnit(media.count(), "item")} to upload
        {/if}

        {#if view.isUpload()}
          {uploadProgressText}
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
