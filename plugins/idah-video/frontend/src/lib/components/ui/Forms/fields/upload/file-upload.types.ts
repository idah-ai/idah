import type { Snippet } from "svelte";

export interface FileUploadBaseProps {
  class?: string | null;
  acceptedFileTypes?: string[] | null;

  onFilesSelected: (selectedFiles: FileList) => Promise<void> | void;

  slotSelectedFiles?: Snippet<[{ selectedFiles: FileList | null }]>;
  slotInfo?: Snippet;
}
