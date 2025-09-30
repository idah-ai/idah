<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";

  import { cn } from "@/utils";

  import type { FileUploadBaseProps } from "@/components/app/forms/fields/upload/file-upload.types";
  import type { ChangeEventHandler } from "svelte/elements";

  // Props
  interface Props extends FileUploadBaseProps {}
  let { class: className, acceptedFileTypes = null, onFilesSelected, slotSelectedFiles, slotInfo }: Props = $props();

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

  function handleDragOver(event: DragEvent): void {}

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

  {#if slotSelectedFiles}
    {@render slotSelectedFiles({ selectedFiles })}
  {:else}
    <Text class="text-accent-foreground text-wrap" size="sm" weight="semibold">
      {#if selectedFiles}
        {#each selectedFiles as selectedFile (selectedFile.name)}
          <span class="line-clamp-1">{selectedFile.name}</span>
        {/each}
      {:else}
        Drag and drop files here or
        <span class="group-hover:underline group-hover:underline-offset-4"> click to select files </span>
      {/if}
    </Text>
  {/if}

  {#if slotInfo}
    {@render slotInfo()}
  {:else}
    <Text class="text-muted-foreground" size="sm">
      Supported file types: {acceptedFileTypesString ?? "All file types"}
    </Text>
  {/if}
</div>
