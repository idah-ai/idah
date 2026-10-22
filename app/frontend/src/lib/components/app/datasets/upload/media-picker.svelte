<script lang="ts">
  import { FileArchiveIcon, FolderIcon } from "@lucide/svelte";

  import FileUpload from "@/components/app/forms/fields/upload/file-upload.svelte";

  import PreviewUploadMediaItem from "./preview-upload-media-item.svelte";

  import { groupIntoDatasets } from "@/components/app/datasets/upload/dataset-groups";
  import { mergePickedFiles, type PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";
  import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";

  import type { FileUploadPicker } from "@/components/app/forms/fields/upload/file-upload.types";

  // Media selection shared by every upload flow: files/folders/zips can be picked
  // or dropped repeatedly; each pick is appended (deduplicated) to `picked`.
  // - "entries": everything is flattened into one dataset (Add Entry)
  // - "datasets": folders/zips only, each becoming one or more new datasets
  interface Props {
    modality: string;
    picked: PickedFile[];
    // Picked/dropped but not accepted (unsupported type, or loose in "datasets" mode); deduplicated.
    ignored?: PickedFile[];
    mode?: "entries" | "datasets";
    class?: string;
  }
  let {
    modality,
    picked = $bindable([]),
    ignored = $bindable([]),
    mode = "entries",
    class: className = "py-12",
  }: Props = $props();

  const PICKERS: Record<"entries" | "datasets", { pickers: FileUploadPicker[]; dropHint: string }> = {
    entries: {
      pickers: [
        { kind: "files", label: "Select files", description: "Media files or .zip archives, added to this dataset" },
        { kind: "folder", label: "Select folder", description: "Everything in the folder and its sub-folders" },
      ],
      dropHint: "or drag and drop files and folders",
    },
    datasets: {
      pickers: [
        { kind: "files", label: "Select zip", description: "Each .zip becomes one dataset", accept: [".zip"] },
        {
          kind: "folder",
          label: "Select folder",
          description: "Each folder becomes one dataset, or one per sub-folder if it has sub-folders",
        },
      ],
      dropHint: "or drag and drop zip files and folders",
    },
  };

  // Variables
  const groups = $derived(mode === "datasets" ? groupIntoDatasets(picked).groups : []);

  // Functions
  // Media types come from the modality's plugin manifest; zip archives are a platform feature on top.
  async function loadAcceptedFileTypes(modality: string): Promise<string[]> {
    const { modalities } = await pluginsBackendDataSource.modalities();
    const mediaTypes = modalities[modality]?.accepted_file_types;
    return mediaTypes ? [".zip", ...mediaTypes] : []; // [] = accept anything
  }

  function handleFilesSelected(added: PickedFile[], unsupported: PickedFile[]): void {
    let newlyIgnored = unsupported;
    if (mode === "datasets") {
      // loose files have no folder/zip to name a dataset after
      const grouped = new Set(groupIntoDatasets(added).groups.flatMap((g) => g.files));
      newlyIgnored = [...newlyIgnored, ...added.filter((p) => !grouped.has(p))];
      added = added.filter((p) => grouped.has(p));
    }
    picked = mergePickedFiles(picked, added);
    ignored = mergePickedFiles(ignored, newlyIgnored); // re-picking the same files doesn't count twice
  }

  function remove(files: PickedFile[]): void {
    const removed = new Set(files);
    picked = picked.filter((p) => !removed.has(p));
    if (picked.length === 0) ignored = []; // nothing left selected, nothing left to report
  }
</script>

{#await loadAcceptedFileTypes(modality) then acceptedFileTypes}
  <FileUpload class={className} {acceptedFileTypes} {...PICKERS[mode]} onFilesSelected={handleFilesSelected} />
{/await}

{#if mode === "datasets" && groups.length > 0}
  <section class="mt-4 flex h-auto max-h-80 flex-col gap-4 overflow-y-auto pr-1">
    {#each groups as group (group.key)}
      {@const isZip = group.files.length === 1 && !group.files[0].path.includes("/")}
      <PreviewUploadMediaItem
        name={group.name}
        icon={isZip ? FileArchiveIcon : FolderIcon}
        onDelete={() => remove(group.files)}
      />
    {/each}
  </section>
{:else if mode === "entries" && picked.length > 0}
  <section class="mt-4 flex h-auto max-h-80 flex-col gap-4 overflow-y-auto pr-1">
    {#each picked as file, index (index)}
      <PreviewUploadMediaItem name={file.file.name} onDelete={() => remove([file])} />
    {/each}
  </section>
{/if}
