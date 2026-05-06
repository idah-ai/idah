<script lang="ts">
  import type { ChangeEventHandler } from "svelte/elements";

  import Text from "@/components/ui/text/Text.svelte";

  import { cn } from "@/utils";

  import type { FileUploadBaseProps } from "@/components/app/forms/fields/upload/file-upload.types";

  // Props
  let {
    class: className,
    acceptedFileTypes = null,
    onFilesSelected,
    SelectedFilesSlot,
    InfoSlot,
  }: FileUploadBaseProps = $props();

  // Variables
  let fileInput: HTMLInputElement;
  let uploading: boolean = $state(false);
  let acceptedFileTypesString: string | null = $derived(acceptedFileTypes ? acceptedFileTypes.join(", ") : null);
  let selectedFiles: FileList | null = $state(null);

  // Functions
  function openChooseFile() {
    if (fileInput) {
      fileInput.click();
    }
  }

  function handleDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  function handleDragLeave(event: DragEvent): void {
    event.preventDefault();
  }

  function handleDrop(event: DragEvent): void {
    event.preventDefault();

    const newFiles = event.dataTransfer?.files;
    if (!newFiles || newFiles.length === 0) return;

    selectedFiles = newFiles;
  }

  const handleChooseFile: ChangeEventHandler<HTMLInputElement> = (event) => {
    const target = event.target as HTMLInputElement;
    selectedFiles = target.files;

    if (selectedFiles) {
      onFilesSelected(selectedFiles);
    }
  };
</script>

<div
  role="button"
  tabindex="0"
  class={cn(
    "bg-secondary group flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4",
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

  <Text class="text-accent-foreground text-wrap" size="sm">
    {#if SelectedFilesSlot}
      {@render SelectedFilesSlot({ selectedFiles })}
    {:else if selectedFiles}
      {#each selectedFiles as selectedFile (selectedFile.name)}
        <span class="line-clamp-1">{selectedFile.name}</span>
      {/each}
    {:else}
      <span class="font-medium underline underline-offset-2">Click to upload</span>
      <span class="text-muted-foreground">or drag and drop</span>
    {/if}
  </Text>

  {#if InfoSlot}
    {@render InfoSlot()}
  {:else}
    <Text class="text-muted-foreground text-center" size="sm">
      Supported file types: {acceptedFileTypesString ?? "All file types"}
    </Text>
  {/if}
</div>
