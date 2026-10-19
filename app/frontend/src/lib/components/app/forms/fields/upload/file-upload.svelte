<script lang="ts">
  import type { ChangeEventHandler } from "svelte/elements";

  import Text from "@/components/ui/text/Text.svelte";

  import {
    collectDroppedFiles,
    fromInputFiles,
    partitionAccepted,
    type PickedFile,
  } from "@/components/app/forms/fields/upload/file-upload.utils";
  import { cn } from "@/utils";
  import { pluralizeUnit } from "@/utils/unit";

  import type { FileUploadBaseProps } from "@/components/app/forms/fields/upload/file-upload.types";

  // Props
  let {
    class: className,
    acceptedFileTypes = null,
    allowFolders = false,
    onFilesSelected,
    SelectedFilesSlot,
    InfoSlot,
  }: FileUploadBaseProps = $props();

  // Variables
  let fileInput: HTMLInputElement;
  let folderInput: HTMLInputElement | undefined = $state();
  let uploading: boolean = $state(false);
  let isDragging: boolean = $state(false);
  let acceptedFileTypesString: string | null = $derived(acceptedFileTypes ? acceptedFileTypes.join(", ") : null);
  let selectedFiles: PickedFile[] | null = $state(null);
  let ignoredCount: number = $state(0);

  // Functions
  function openChooseFile() {
    if (fileInput) {
      fileInput.click();
    }
  }

  function openChooseFolder(event: Event) {
    event.stopPropagation(); // the whole drop zone opens the file picker otherwise
    folderInput?.click();
  }

  // Unsupported files (e.g. .DS_Store inside a folder) are dropped and counted, not silently lost.
  function select(picked: PickedFile[]): void {
    const { accepted, ignored } = partitionAccepted(picked, acceptedFileTypes);
    ignoredCount = ignored;
    if (accepted.length === 0) return;

    selectedFiles = accepted;
    onFilesSelected(accepted);
  }

  function handleDragOver(event: DragEvent): void {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    isDragging = false;
  }

  async function handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    isDragging = false;

    const items = event.dataTransfer?.items;
    if (!items || items.length === 0) return;

    select(allowFolders ? await collectDroppedFiles(items) : fromInputFiles(event.dataTransfer!.files));
  }

  const handleChooseFile: ChangeEventHandler<HTMLInputElement> = (event) => {
    const target = event.target as HTMLInputElement;
    if (target.files) select(fromInputFiles(target.files));
    target.value = ""; // allow picking the same file/folder again
  };
</script>

<div
  role="button"
  tabindex="0"
  class={cn(
    "bg-secondary group flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4",
    isDragging && "border-primary bg-primary/5",
    className,
  )}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  onkeypress={openChooseFile}
  onclick={openChooseFile}
>
  <input
    bind:this={fileInput}
    multiple
    type="file"
    class="hidden"
    accept={acceptedFileTypesString}
    onchange={handleChooseFile}
    disabled={uploading}
  />

  {#if allowFolders}
    <input
      bind:this={folderInput}
      webkitdirectory
      type="file"
      class="hidden"
      onchange={handleChooseFile}
      disabled={uploading}
    />
  {/if}

  <Text class="text-accent-foreground text-wrap" size="sm">
    {#if SelectedFilesSlot}
      {@render SelectedFilesSlot({ selectedFiles })}
    {:else if selectedFiles}
      {#each selectedFiles as selectedFile (selectedFile.path)}
        <span class="line-clamp-1">{selectedFile.path}</span>
      {/each}
    {:else}
      <span class="font-medium underline underline-offset-2">Click to select files</span>
      <span class="text-muted-foreground">or drag and drop</span>
    {/if}
  </Text>

  {#if allowFolders}
    <Text class="text-muted-foreground" size="sm">
      or
      <button
        type="button"
        class="text-accent-foreground font-medium underline underline-offset-2"
        onclick={openChooseFolder}
      >
        select a folder
      </button>
    </Text>
  {/if}

  {#if ignoredCount > 0}
    <Text class="text-muted-foreground" size="sm">
      {ignoredCount} unsupported {pluralizeUnit(ignoredCount, "file")} ignored
    </Text>
  {/if}

  {#if InfoSlot}
    {@render InfoSlot()}
  {:else}
    <Text class="text-muted-foreground text-center" size="sm">
      Supported file types: {acceptedFileTypesString ?? "All file types"}
    </Text>
  {/if}
</div>
