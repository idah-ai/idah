<script lang="ts">
  import { FileArchiveIcon, FolderIcon } from "@lucide/svelte";

  import FileUpload from "@/components/app/forms/fields/upload/file-upload.svelte";

  import PreviewUploadMediaItem from "./preview-upload-media-item.svelte";

  import { groupIntoDatasets, pickedItems } from "@/components/app/datasets/upload/dataset-groups";
  import { mergePickedFiles, type PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";

  import type { FileUploadPicker } from "@/components/app/forms/fields/upload/file-upload.types";

  // Media selection shared by every upload flow: files/folders/zips can be picked
  // or dropped repeatedly; each pick is appended (deduplicated) to `picked`.
  // - "entries": everything is flattened into one dataset (Add Entry)
  // - "datasets": folders/zips only, each becoming one or more new datasets
  interface Props {
    picked: PickedFile[];
    // "datasets" mode: loose files (outside any folder or zip), reported in the summary; deduplicated.
    ignored?: PickedFile[];
    mode?: "entries" | "datasets";
    class?: string;
  }
  let {
    picked = $bindable([]),
    ignored = $bindable([]),
    mode = "entries",
    class: className = "py-12",
  }: Props = $props();

  // A browser folder dialog picks one folder at a time, so the texts say how to add more:
  // pick again (each pick is appended) or drop several folders at once.
  const PICKERS: Record<"entries" | "datasets", { pickers: FileUploadPicker[]; dropHint: string }> = {
    entries: {
      pickers: [
        { kind: "files", label: "Select files", description: "Media files or .zip archives, added to this dataset" },
        {
          kind: "folder",
          label: "Select folder",
          description: "Everything in the folder and its sub-folders (pick again to add more)",
        },
      ],
      dropHint: "or drag and drop files and folders, several at once",
    },
    datasets: {
      pickers: [
        { kind: "files", label: "Select zip", description: "Each .zip becomes one dataset", accept: [".zip"] },
        {
          kind: "folder",
          label: "Select folder",
          description:
            "Each folder becomes one dataset, or one per sub-folder and zip inside it (pick again to add more)",
        },
      ],
      dropHint: "or drag and drop zip files and folders, several at once",
    },
  };

  // Variables
  // "datasets" mode lists what was picked, not a prediction of the datasets: that is
  // only known after upload (the summary shows it).
  const items = $derived(mode === "datasets" ? pickedItems(picked) : []);

  // Functions
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

<!-- No media-type filter here: the server decides per file and reports what it skipped. -->
<FileUpload class={className} {...PICKERS[mode]} onFilesSelected={handleFilesSelected} />

{#if mode === "datasets" && items.length > 0}
  <section class="mt-4 flex h-auto max-h-80 flex-col gap-4 overflow-y-auto pr-1">
    {#each items as item (item.key)}
      <PreviewUploadMediaItem
        name={item.name}
        icon={item.isZip ? FileArchiveIcon : FolderIcon}
        onDelete={() => remove(item.files)}
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
