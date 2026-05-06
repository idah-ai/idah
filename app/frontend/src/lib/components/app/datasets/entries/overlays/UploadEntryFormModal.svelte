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
    success(): number;
    successCount(): number;

    error(): number;
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
          <span class="font-medium underline underline-offset-2">Click to upload</span>
          <span class="text-muted-foreground">or drag and drop</span>
        </Text>
      {/snippet}
    </FileUpload>

    {#if media.any()}
      <section class="flex h-80 flex-col gap-4 overflow-y-auto pr-1">
        {#each media.selected as file, index (index)}
          <PreviewUploadMediaItem name={file.name} onDelete={() => removeMedia(index)} />
        {/each}
      </section>
    {/if}
  {/if}

  {#if view.isUpload()}
    <section class="flex flex-col gap-4">
      <!-- {#each media.} -->
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
