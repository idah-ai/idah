<script lang="ts">
  import { page } from "$app/state";

  import FileUpload from "@/components/app/forms/fields/upload/file-upload.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogClose from "@/components/ui/dialog/dialog-close.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { mediaBackendDataSource } from "@/data/model/media/medias/medias-record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import { truncateFront } from "@/utils/string";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

  // Types
  interface CreateEntryFormModalProps extends FormModalBaseProps {
    modality: string;
  }

  // Props
  let { action, title, open = $bindable(), modality }: CreateEntryFormModalProps = $props();

  // Variables
  interface UploadStatuses {
    name: string;
    compressedName: string | null;
    status: "uploading" | "success" | "error" | "skipped" | "archive";
    message?: string;
  }

  let projectId = page.params.projectId as string;
  let datasetId = page.params.datasetId as string;
  let selectedMedias: FileList | null = $state(null);
  let uploading: boolean = $state(false);
  let uploadStatuses: Array<UploadStatuses> = $state([]);
  let showUploadStatus: boolean = $derived(uploadStatuses.length > 0);

  let disabledUploadButton: boolean = $derived.by(() => {
    if (!selectedMedias) return true;

    if (!selectedMedias.length) return true;

    if (uploading) return true;

    if (showUploadStatus) return true;

    return false;
  });

  const acceptedFileTypes =
    modality === "idah-video"
      ? [".mp4", ".mkv", ".3gp", ".avi", ".m4v", ".mov", ".webm", ".zip"]
      : [".jpg", ".jpeg", ".png", ".zip"];

  // Functions
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

  function isZipFile(filename: string): boolean {
    return filename.toLowerCase().endsWith(".zip");
  }

  async function uploadMedia(): Promise<void> {
    if (!selectedMedias || selectedMedias.length === 0) {
      showToast.error({ title: "No media selected for upload." });
      return;
    }

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    /** One "uploading" placeholder per selected file; final rows replace the placeholder
     * in place, with extracted zip contents inserted right after their archive row */
    uploadStatuses = Array.from(selectedMedias).map((media) => ({
      name: media.name,
      compressedName: null,
      status: "uploading" as const,
    }));
    let cursor = 0;

    for (const media of selectedMedias) {
      const uuid = crypto.randomUUID().replace(/-/g, "").substring(0, 16);
      const fileExtension = getFileExtension(media.name);
      const resourceKey = `${uuid}${fileExtension}`;
      const isZip = isZipFile(media.name);

      let placeholderReplaced = false;
      const finalizeRow = (row: UploadStatuses): void => {
        if (placeholderReplaced) {
          uploadStatuses.splice(cursor, 0, row);
        } else {
          uploadStatuses[cursor] = row;
          placeholderReplaced = true;
        }
        cursor++;
      };

      try {
        const createdMedias = await mediaBackendDataSource.upload(media, resourceKey, projectId, "", modality);

        if (!("data" in createdMedias)) {
          throw new Error("Media upload failed");
        }

        if (isZip) {
          finalizeRow({ name: media.name, compressedName: null, status: "archive" });
        }

        if (createdMedias.meta?.skipped) {
          for (const skippedFile of createdMedias.meta.skipped) {
            skippedCount++;
            finalizeRow({
              name: skippedFile.filename,
              compressedName: isZip ? media.name : null,
              status: "skipped",
              message: skippedFile.message,
            });
          }
        }

        if (createdMedias.meta?.errored) {
          for (const erroredFile of createdMedias.meta.errored) {
            errorCount++;
            finalizeRow({
              name: erroredFile.filename,
              compressedName: isZip ? media.name : null,
              status: "error",
              message: erroredFile.message,
            });
          }
        }

        for (const createdMedia of createdMedias.data) {
          try {
            await entriesBackendDataSource.create(
              {
                attributes: { resource: createdMedia.resource, name: createdMedia.filename, status: "pending" },
                relationships: { dataset: { data: { type: "datasets:datasets", id: datasetId } } },
              },
              { showErrorToast: false },
            );
            processedCount++;
            finalizeRow({
              name: createdMedia.filename,
              compressedName: isZip ? media.name : null,
              status: "success",
            });
          } catch (error) {
            /** A failed entry must not abort the rest of the batch */
            console.error(`Entry creation failed for ${createdMedia.filename}:`, error);
            errorCount++;
            finalizeRow({
              name: createdMedia.filename,
              compressedName: isZip ? media.name : null,
              status: "error",
              message: "Entry creation failed",
            });
          }
        }
      } catch (error) {
        /** Continue with the remaining files instead of aborting the batch */
        console.error(`Upload failed for ${media.name}:`, error);
        finalizeRow({
          name: media.name,
          compressedName: null,
          status: "error",
          message: error instanceof Error ? error.message : undefined,
        });
        errorCount++;
      }
    }

    if (errorCount > 0) {
      const skippedNote = skippedCount > 0 ? ` ${skippedCount} files were skipped.` : "";
      showToast.error({
        title: "Some files failed to upload",
        description: `Successfully uploaded ${processedCount} entries.${skippedNote} ${errorCount} files failed.`,
      });
    } else if (skippedCount > 0) {
      showToast.success({
        title: "Entries uploaded with skips",
        description: `Successfully uploaded ${processedCount} entries. ${skippedCount} files were skipped.`,
      });
    } else {
      showToast.success({
        title: "Entries uploaded",
        description: `Successfully uploaded ${processedCount} entries.`,
      });
    }

    if (processedCount > 0) {
      $refetches.entries.list = new Date();
    }
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
  canClickOutside={false}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  {#if showUploadStatus}
    <div class="flex w-full flex-col gap-4">
      {#each uploadStatuses as { name, compressedName, status, message }, i (i)}
        {@const displayName = truncateFront(name, 35)}
        <div class="flex w-full items-center gap-4">
          {#if compressedName !== null}
            <ChevronRightIcon class="text-muted-foreground size-4 shrink-0" />
          {/if}

          <Text size="sm">
            {#if status === "archive"}
              <strong>{displayName}</strong>
            {:else}
              {displayName}
            {/if}
          </Text>
          <div class="ml-auto flex items-center gap-2">
            {#if message}
              <Text size="xs" class="text-muted-foreground">{message}</Text>
            {/if}

            {#if status === "uploading"}
              <Spinner size="sm" />
            {:else if status === "success"}
              <Badge>Uploaded</Badge>
            {:else if status === "skipped"}
              <Badge variant="secondary">Skipped</Badge>
            {:else if status === "error"}
              <Badge variant="destructive">Error</Badge>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <FileUpload class="py-12" {acceptedFileTypes} onFilesSelected={handleFilesSelected} />
  {/if}

  {#snippet actions()}
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
