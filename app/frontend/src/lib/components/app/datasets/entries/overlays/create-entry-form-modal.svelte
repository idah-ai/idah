<script lang="ts">
  import { page } from "$app/state";
  import { toast } from "svelte-sonner";

  import FileUpload from "@/components/app/forms/fields/upload/file-upload.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogClose from "@/components/ui/dialog/dialog-close.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { mediaBackendDataSource } from "@/data/model/media/medias/medias-record";
  import { refetches } from "@/utils/refetch";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

  // Props
  let { action, title, open = $bindable() }: FormModalBaseProps = $props();

  // Variables
  interface UploadStatuses {
    uuid: string;
    media: File;
    status: "uploading" | "success" | "error";
  }
  let uploadStatuses: Array<UploadStatuses> = $state([]);

  let projectId = page.params.projectId as string;
  let datasetId = page.params.datasetId as string;
  let uploading: boolean = $state(false);
  let selectedMedias: FileList | null = $state(null);
  let showUploadStatus: boolean = $derived(uploadStatuses.length > 0);

  let disabledUploadButton: boolean = $derived.by(() => {
    if (!selectedMedias) return true;

    if (!selectedMedias.length) return true;

    if (uploading) return true;

    if (showUploadStatus) return true;

    return false;
  });

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

  async function uploadMedia(): Promise<void> {
    if (!selectedMedias || selectedMedias.length === 0) {
      toast.error("No media selected for upload.");
      return;
    }

    /** Generate an upload statuses */
    uploadStatuses = Array.from(selectedMedias).map((media) => ({
      uuid: crypto.randomUUID().replace(/-/g, "").substring(0, 16),
      media: media,
      status: "uploading" as const,
    }));

    for (const media of uploadStatuses) {
      try {
        const fileExtension = getFileExtension(media.media.name);
        const resourceKey = `${media.uuid}${fileExtension}`;

        const createdMedia = await mediaBackendDataSource.upload(media.media, resourceKey, projectId);

        if (!("data" in createdMedia)) {
          throw new Error("Media upload failed");
        }

        await entriesBackendDataSource.create({
          attributes: {
            resource: createdMedia.data.resource,
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
        });

        media.status = "success";
      } catch (error) {
        console.error(error);
        media.status = "error";
      }
    }

    toast.success("Entries successfully uploaded!");
    $refetches.entries.list = new Date();
  }

  async function submit(): Promise<void> {
    uploading = true;

    try {
      await uploadMedia();
    } catch (error) {
      console.error(error);
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
      {#each uploadStatuses as { uuid, media, status } (uuid)}
        <div class="flex w-full gap-4">
          <Text size="sm">{media.name}</Text>

          <div class="ml-auto">
            {#if status === "uploading"}
              <Spinner size="sm"></Spinner>
            {:else if status === "success"}
              <Badge>Uploaded</Badge>
            {:else if status === "error"}
              <Badge variant="destructive">Error</Badge>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <FileUpload
      class="py-12"
      acceptedFileTypes={[".mp4", ".mkv", ".3gp", ".avi", ".m4v", ".mov", ".webm"]}
      onFilesSelected={handleFilesSelected}
    ></FileUpload>
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
