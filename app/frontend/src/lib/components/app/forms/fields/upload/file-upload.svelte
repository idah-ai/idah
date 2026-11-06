<script lang="ts">
  import { FileArchiveIcon, FileIcon, FolderIcon } from "@lucide/svelte";
  import type { ChangeEventHandler } from "svelte/elements";

  import Button from "@/components/ui/button/button.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import {
    collectDroppedFiles,
    fromInputFiles,
    partitionAccepted,
    type PickedFile,
  } from "@/components/app/forms/fields/upload/file-upload.utils";
  import { cn } from "@/utils";

  import type { FileUploadBaseProps, FileUploadPicker } from "@/components/app/forms/fields/upload/file-upload.types";

  // Props
  let {
    class: className,
    acceptedFileTypes = null,
    pickers,
    dropHint,
    onFilesSelected,
  }: FileUploadBaseProps = $props();

  // Variables
  let inputs: HTMLInputElement[] = $state([]);
  let isDragging: boolean = $state(false);
  let allowFolders: boolean = $derived(pickers.some((picker) => picker.kind === "folder"));

  // Functions
  // Unsupported files (e.g. notes.txt inside a folder) are reported, not silently lost.
  function select(picked: PickedFile[]): void {
    const { accepted, ignored } = partitionAccepted(picked, acceptedFileTypes);
    onFilesSelected(accepted, ignored);
  }

  function iconFor(picker: FileUploadPicker) {
    if (picker.kind === "folder") return FolderIcon;
    return picker.accept?.length === 1 && picker.accept[0] === ".zip" ? FileArchiveIcon : FileIcon;
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

<!-- A single native input can pick files OR folders, never both, hence one button each. -->
<div
  role="region"
  aria-label="Upload drop zone"
  class={cn(
    "bg-secondary flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4",
    isDragging && "border-primary bg-primary/5",
    className,
  )}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
    {#each pickers as picker, index (picker.kind)}
      {@const Icon = iconFor(picker)}
      {#if picker.kind === "folder"}
        <input bind:this={inputs[index]} webkitdirectory type="file" class="hidden" onchange={handleChooseFile} />
      {:else}
        <input
          bind:this={inputs[index]}
          multiple
          type="file"
          class="hidden"
          accept={(picker.accept ?? acceptedFileTypes)?.join(", ") ?? null}
          onchange={handleChooseFile}
        />
      {/if}

      <Button type="button" variant="outline" size="sm" class="justify-start" onclick={() => inputs[index]?.click()}>
        <Icon />
        {picker.label}
      </Button>
      <Text class="text-muted-foreground" size="sm">{picker.description}</Text>
    {/each}
  </div>

  <Text class="text-muted-foreground" size="sm">{dropHint}</Text>
</div>
