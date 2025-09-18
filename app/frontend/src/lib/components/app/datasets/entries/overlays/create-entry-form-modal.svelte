<script lang="ts">
  import FileUpload from "@/components/app/forms/fields/upload/file-upload.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

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
  let submitting: boolean = $state(false);
  let selectedMedia: File | null = $state(null);
  let entry: EntryRecord = $derived(
    new EntryRecord({
      type: EntryRecord.type,
      attributes: {},
    }),
  );
  let datasetId = page.params.datasetId as string;

  // Functions
  function resetForm(): void {
    entry = new EntryRecord({
      type: EntryRecord.type,
      attributes: {},
    });
  }

  function handleFilesSelected(selectedFile: File): void {
    selectedMedia = selectedFile;
    console.log("Selected file:", selectedMedia);

  }

  function generateRandomUUID(length: number = 16): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += Math.floor(Math.random() * 36).toString(36);
    }
    return result;
  }

  function getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
  }

  async function importMedia(): Promise<void> {
    // Generate random UUID with file extension
    const randomUUID = generateRandomUUID(16);
    const fileExtension = getFileExtension(selectedMedia.name);
    const resourceKey = `${randomUUID}${fileExtension}`;

    const mediaRes = await mediaBackendDataSource.upload(selectedMedia, resourceKey);

    const createdEntryRes = await entriesBackendDataSource.create({
      attributes: {
        resource: mediaRes.data.resource,
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

    toast.success("Tasks successfully uploaded!");
    $refetches.entries.list++;
    open = false;
  }

  async function submit(): Promise<void> {
    submitting = true;

    try {
      await importMedia();
    } catch (error) {
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal
  {action}
  {title}
  description="Import media from your computer"
  loading={submitting}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  <FileUpload
    class="py-12"
    acceptedFileTypes={[".mp4", ".mkv", ".3gp", ".avi", ".m4v", ".mov", ".webm"]}
    onFileSelected={handleFilesSelected}
  ></FileUpload>

  {#snippet confirm()}
    <Button onclick={submit}>Upload</Button>
  {/snippet}
</FormModal>
