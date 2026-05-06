<script lang="ts">
  import { page } from "$app/state";

  import FileUpload from "@/components/app/forms/fields/upload/file-upload.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogClose from "@/components/ui/dialog/dialog-close.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { mediaBackendDataSource } from "@/data/model/media/medias/medias-record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

  // Props
  let { action, title, open = $bindable() }: FormModalBaseProps = $props();

  // Types
  interface UploadMedia {
    uuid: string;
    media: File;
    status: "uploading" | "retrying" | "success" | "error";
    retryCount: number; // auto-retry attemps consumed
    errorMessage?: string; // last error message for display
    /**
     * uploadedResource is critical;
     * If media upload succeeds but entry create fails,
     * the retry must skip straight to entry creation. (the backend rejects duplicate resource keys)
     */
    uploadedResource?: string; // set once media upload succeeds - skip on retry
  }

  // Variables
  let projectId = page.params.projectId as string;
  let datasetId = page.params.datasetId as string;
  let selectedMedias: FileList | null = $state(null);
  let uploading: boolean = $state(false);
  let uploadMedias: Array<UploadMedia> = $state([]);
  let showUploadStatus: boolean = $derived(uploadMedias.length > 0);

  let disabledUploadButton: boolean = $derived.by(() => {
    if (!selectedMedias) return true;

    if (!selectedMedias.length) return true;

    if (uploading) return true;

    if (showUploadStatus) return true;

    return false;
  });

  // Functions
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

  function resetForm(): void {
    selectedMedias = null;
    uploadStatuses = [];
    uploading = false;
  }

  function handleFilesSelected(selectedFiles: FileList): void {
    selectedMedias = selectedFiles;
  }

  function getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf(".");
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : "";
  }

  async function uploadSingleMedia(media: UploadMedia): Promise<void> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        media.status = "retrying";
        media.retryCount = attempt;
        await sleep(retryDelay(attempt - 1));
      }

      try {
        // Skip media upload if prior attempt already succeeded
        if (!media.uploadedResource) {
          const fileExtension = getFileExtension(media.media.name);
          const resourceKey = `${media.uuid}${fileExtension}`;
          const createdMedia = await mediaBackendDataSource.upload(media.media, resourceKey, projectId);

          if (!("data" in createdMedia)) throw new Error("Media upload failed");

          media.uploadedResource = createdMedia.data.resource;

          await entriesBackendDataSource.create(
            {
              attributes: {
                resource: media.uploadedResource,
                name: createdMedia.data.filename,
                status: "pending",
              },
              relationships: {
                dataset: {
                  data: {
                    type: "datasets:datasets",
                    id: datasetId,
                  },
                },
              },
            },
            { showErrorToast: false },
          );

          media.status = "success";
          media.errorMessage = undefined;
          return; // done
        }
      } catch (error) {
        media.errorMessage = error instanceof Error ? error.message : "Upload failed";
      }
    }

    media.status = "error"; // exhausted all retries
  }

  async function uploadMedia(): Promise<void> {
    if (!selectedMedias || selectedMedias.length === 0) {
      showToast.error({ title: "No media selected for upload." });
      return;
    }

    /** Generate an upload statuses */
    uploadMedias = Array.from(selectedMedias).map((media) => ({
      uuid: crypto.randomUUID().replace(/-/g, "").substring(0, 16),
      media,
      status: "uploading" as const,
      retryCount: 0,
    }));

    for (const media of uploadMedias) {
      media.status = "uploading";
      await uploadSingleMedia(media); // never throws — loop always continues
    }

    const failed = uploadMedias.filter((s) => s.status === "error").length;
    const succeeded = uploadMedias.filter((s) => s.status === "success").length;

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

  async function retryFailedUploads(): Promise<void> {
    const failedItems = uploadMedias.filter((s) => s.status === "error");
    if (!failedItems.length) return;

    uploading = true;
    // Reset retry counter so they get MAX_RETRIES fresh attempts
    failedItems.forEach((item) => {
      item.retryCount = 0;
      item.errorMessage = undefined;
    });

    for (const media of failedItems) {
      media.status = "uploading";
      await uploadSingleMedia(media);
    }

    const stillFailed = uploadMedias.filter((s) => s.status === "error").length;
    if (stillFailed === 0) {
      showToast.success({ title: "All failed uploads retried successfully." });
      $refetches.entries.list = new Date();
    }

    uploading = false;
  }

  async function submit(): Promise<void> {
    uploading = true;

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
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  {#if showUploadStatus}
    <div class="flex w-full flex-col gap-4">
      {#each uploadMedias as { uuid, media, status, retryCount, errorMessage } (uuid)}
        <div class="flex w-full items-center gap-4">
          <Text size="sm" class="truncate">{media.name}</Text>

          <div class="ml-auto flex shrink-0 items-center gap-2">
            {#if status === "uploading"}
              <Spinner size="sm" />
            {:else if status === "retrying"}
              <Spinner size="sm" />
              <Badge variant="secondary">Retry {retryCount}/{MAX_RETRIES}</Badge>
            {:else if status === "success"}
              <Badge>Uploaded</Badge>
            {:else if status === "error"}
              <Badge variant="destructive" title={errorMessage}>Failed</Badge>
            {/if}
          </div>
        </div>
      {/each}

      <!-- Retry all failed button — shown once auto-retries are exhausted -->
      {#if !uploading && uploadMedias.some((s) => s.status === "error")}
        <Button variant="outline" size="sm" onclick={retryFailedUploads}>Retry Failed</Button>
      {/if}
    </div>
  {:else}
    <FileUpload
      class="py-12"
      acceptedFileTypes={[".mp4", ".mkv", ".3gp", ".avi", ".m4v", ".mov", ".webm"]}
      onFilesSelected={handleFilesSelected}
    />
  {/if}

  {#snippet actions()}
    <!-- Only show actions when not uploading -->
    {#if !showUploadStatus}
      <DialogClose>
        <Button variant="outline" class="w-full lg:w-auto" onclick={resetForm}>Cancel</Button>
      </DialogClose>

      <Button loading={uploading} loadingLabel="Uploading" disabled={disabledUploadButton} onclick={submit}>
        Upload
      </Button>
    {/if}
  {/snippet}
</FormModal>
