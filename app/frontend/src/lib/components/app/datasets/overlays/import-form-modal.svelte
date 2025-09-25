<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import FileUpload from "@/components/app/forms/fields/upload/file-upload.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Spinner from "@/components/app/loading/spinner.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
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
  let projectId = page.params.projectId as string;
  let uploading: boolean = $state(false);
  let selectedDatset: FileList | null = $state(null);
  let entry: EntryRecord = $derived(
    new EntryRecord({
      type: EntryRecord.type,
      attributes: {},
    }),
  );

  interface ImportStatuses {
    uuid: string;
    datset: File;
    status: "importing" | "success" | "error";
  }
  let importStatuses: Array<ImportStatuses> = $state([]);

  // Functions
  function resetForm(): void {
    entry = new EntryRecord({
      type: EntryRecord.type,
      attributes: {},
    });
  }

  function handleFilesSelected(selectedFiles: FileList): void {
    selectedDatset = selectedFiles;
  }

  function getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf(".");
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : "";
  }

  async function importDatset(projectId: string): Promise<void> {
    if (!selectedDatset || selectedDatset.length === 0) {
      toast.error("No .datset file selected for import.");
      return;
    }

    /** Generate an upload statuses */
    importStatuses = Array.from(selectedDatset).map((datset) => ({
      uuid: crypto.randomUUID().replace(/-/g, "").substring(0, 16),
      datset: datset,
      status: "importing" as const,
    }));

    // TODO: currently aligning with entry adding modal, subject to change
    for (const file of importStatuses) {
      try {
        const fileExtension = getFileExtension(file.datset.name);
        const resourceKey = `${file.uuid}${fileExtension}`;

        // uploading the file
        const createdDatset = await datasetsBackendDataSource.import(file.datset, resourceKey, projectId);
        if (!("data" in createdDatset)) {
          throw new Error("Datset import failed");
        }

        file.status = "success";
      } catch (error) {
        file.status = "error";
      }
    }

    // TODO: handle error/failure properly
    toast.success("Dataset is successfully imported.");
    $refetches.entries.list++;
    open = false;
  }

  async function submit(): Promise<void> {
    uploading = true;

    try {
      await importDatset(projectId);
      $refetches.datasets.list++;
    } catch (error) {
    } finally {
      uploading = false;
    }
  }
</script>

<!-- TODO: fix title, currently using base class' title ('Add New ...') -->
<FormModal
  {action}
  {title}
  description="Import .datset file from your computer"
  loading={uploading}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  {#if uploading}
    <div class="flex w-full flex-col gap-4">
      {#each importStatuses as { uuid, datset, status } (uuid)}
        <div class="flex w-full gap-4">
          <Text size="sm">{datset.name}</Text>

          <div class="ml-auto">
            {#if status === "importing"}
              <Spinner></Spinner>
            {:else if status === "success"}
              <Badge class="rounded-lg">Imported</Badge>
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
      acceptedFileTypes={[".datset"]}
      onFilesSelected={handleFilesSelected}
    ></FileUpload>
  {/if}

  {#snippet confirm()}
    <Button onclick={submit}>Import</Button>
  {/snippet}
</FormModal>
