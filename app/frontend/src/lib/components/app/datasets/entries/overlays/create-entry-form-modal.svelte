<script lang="ts">
  import FileUpload from "@/components/app/forms/fields/upload/file-upload.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

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

  // Functions
  function resetForm(): void {
    entry = new EntryRecord({
      type: EntryRecord.type,
      attributes: {},
    });
  }

  function handleFilesSelected(selectedFile: File): void {
    selectedMedia = selectedFile;
  }

  async function importMedia(): Promise<void> {
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
