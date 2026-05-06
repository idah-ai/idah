<script lang="ts">
  import { page } from "$app/state";

  import FileUpload from "@/components/app/forms/fields/upload/file-upload.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogClose from "@/components/ui/dialog/dialog-close.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import PreviewUploadMediaItem from "./_PreviewUploadMediaItem.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { mediaBackendDataSource } from "@/data/model/media/medias/medias-record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { truncateFront } from "@/utils/string";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import UploadMediaItem from "./_UploadMediaItem.svelte";

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
    selected: FileList | null;
    count(): number;
    any(): boolean;
  }

  interface UploadItem {
    uuid: string;
    media: File;
    status: "uploading" | "success" | "error" | "skipped" | "archive";
    retryCount: number; // auto-retry attempts consumed
    errorMessage?: string; // last error for display
    uploadedResource?: string; // set once media upload succeeds — skip on retry
  }

  interface Upload {
    items: Array<UploadItem>;
    success(): Array<UploadItem>;
    successCount(): number;

    error(): Array<UploadItem>;
    errorCount(): number;
  }

  // Variables
  const acceptedFileTypes =
    modality === "idah-video"
      ? [".zip", ".mp4", ".mkv", ".3gp", ".avi", ".m4v", ".mov", ".webm", ".zip"]
      : [".zip", ".jpg", ".jpeg", ".png", ".zip"];
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

    success() {
      return this.items.filter((item) => item.status === "success");
    },
    successCount() {
      return this.success().length;
    },

    error() {
      return this.items.filter((item) => item.status === "error");
    },
    errorCount() {
      return this.error().length;
    },
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
    media.selected = selectedFiles;
  }

  function removeMedia(index: number) {
    if (!media.selected) return;
    media.selected = Array.from(media.selected).filter((_, i) => i !== index) as unknown as FileList;
  }

  function getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf(".");
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : "";
  }

  function isZipFile(filename: string): boolean {
    return filename.toLowerCase().endsWith(".zip");
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

  async function uploadSingleMedia(media: UploadItem): Promise<void> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        media.status = "retrying";
        media.retryCount = attempt;
        await sleep(retryDelay(attempt - 1));
      }

      try {
        // Skip media upload if a prior attempt already succeeded
        if (!media.uploadedResource) {
          const fileExtension = getFileExtension(media.media.name);
          const resourceKey = `${media.uuid}${fileExtension}`;
          const createdMedia = await mediaBackendDataSource.upload(media.media, resourceKey, projectId);
          if (!("data" in createdMedia)) throw new Error("Media upload failed");
          media.uploadedResource = createdMedia.data.resource; // ← checkpoint
        }

        await entriesBackendDataSource.create(
          {
            attributes: {
              resource: media.uploadedResource,
              name: media.media.name,
              status: "pending",
            },
            relationships: { dataset: { data: { type: "datasets:datasets", id: datasetId } } },
          },
          { showErrorToast: false },
        );

        media.status = "success";
        media.errorMessage = undefined;
        return; // done
      } catch (error) {
        media.errorMessage = error instanceof Error ? error.message : "Upload failed";
      }
    }

    media.status = "error"; // exhausted all retries
  }

  async function uploadMedia(): Promise<void> {
    if (!media.any()) {
      showToast.error({ title: "No media selected for upload." });
      return;
    }

    upload.items = Array.from(media.selected!).map((media) => ({
      uuid: crypto.randomUUID().replace(/-/g, "").substring(0, 16),
      media,
      status: "uploading" as const,
      retryCount: 0,
    }));

    for (const media of upload.items) {
      media.status = "uploading";
      await uploadSingleMedia(media); // never throws — loop always continues
    }

    const failed = upload.items.filter((s) => s.status === "error").length;
    const succeeded = upload.items.filter((s) => s.status === "success").length;

    if (failed === 0) {
      showToast.success({ title: "All entries uploaded successfully." });
      $refetches.entries.list = new Date();
    } else if (succeeded > 0) {
      showToast.warning({ title: `${succeeded} uploaded, ${failed} failed after ${MAX_RETRIES} retries.` });
      $refetches.entries.list = new Date();
    } else {
      showToast.error({ title: "All uploads failed." });
    }
  }

  async function submit(): Promise<void> {
    uploading = true;
    view.current = "upload";

    // try {
    //   await uploadMedia();
    // } catch (error) {
    //   showActionFailedToast(error);
    // } finally {
    //   uploading = false;
    // }
  }
</script>

<FormModal
  {action}
  {title}
  description="Import media from your computer"
  loading={uploading}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
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
      {#each Array.from({ length: 8 }) as _, i (i)}
        <UploadMediaItem name="Media 0{i + 1}" info="12 MB" />
      {/each}
    </section>
  {/if}

  {#snippet actions()}
    <section class="flex w-full items-center">
      <Text>
        {#if view.isSelect() && media.any()}
          {media.count()} files to uploaded
        {/if}

        {#if view.isUpload()}
          {upload.successCount()} of {media.count()} files uploaded
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
