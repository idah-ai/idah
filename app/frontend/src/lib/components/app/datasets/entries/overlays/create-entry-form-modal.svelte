<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import FileUpload from "@/components/app/forms/fields/upload/file-upload.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Spinner from "@/components/app/loading/spinner.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { mediaBackendDataSource } from "@/data/model/media/medias/medias-record";
  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { page } from "$app/state";

  import { refetches } from "@/utils/refetch";
  import { toast } from "svelte-sonner";

  import { EntryRecord } from "@/data/model/dataset/entries/record";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

  // Props
  interface Props extends FormModalBaseProps {}
  let { action, title, open = $bindable() }: Props = $props();

  // Variables
  let datasetId = page.params.datasetId as string;
  let uploading: boolean = $state(false);
  let selectedMedias: FileList | null = $state(null);
  let entry: EntryRecord = $derived(
    new EntryRecord({
      type: EntryRecord.type,
      attributes: {},
    }),
  );

  interface UploadStatuses {
    uuid: string;
    media: File;
    status: "uploading" | "success" | "error";
  }
  let uploadStatuses: Array<UploadStatuses> = $state([]);

  // Functions
  function resetForm(): void {
    entry = new EntryRecord({
      type: EntryRecord.type,
      attributes: {},
    });
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

        const createdMedia = await mediaBackendDataSource.upload(media.media, resourceKey);

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
        media.status = "error";
      }
    }

    toast.success("Tasks successfully uploaded!");
    $refetches.entries.list++;
    open = false;
  }

  async function submit(): Promise<void> {
    uploading = true;

    try {
      await uploadMedia();
    } catch (error) {
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
  {#if uploading}
    <div class="flex w-full flex-col gap-4">
      {#each uploadStatuses as { uuid, media, status } (uuid)}
        <div class="flex w-full gap-4">
          <Text size="sm">{media.name}</Text>

          <div class="ml-auto">
            {#if status === "uploading"}
              <Spinner></Spinner>
            {:else if status === "success"}
              <Badge class="rounded-lg">Uploaded</Badge>
            {:else if status === "error"}
              <Badge variant="destructive" class="rounded-lg">Error</Badge>
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

  {#snippet confirm()}
    <Button disabled={!selectedMedias || selectedMedias.length === 0} onclick={submit}>
      {#if uploading}
        <Spinner></Spinner>
        Uploading...
      {:else}
        Upload
      {/if}
    </Button>
  {/snippet}
</FormModal>
