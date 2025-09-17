import type { Snippet } from "svelte";

export interface FileUploadBaseProps {
  class?: string | null;
  acceptedFileTypes?: string[] | null;

  onFileSelected: (selectedFile: File) => Promise<void> | void;

  slotSelectedFile?: Snippet<[{ selectedFiles: FileList | null }]>;
  slotInfo?: Snippet;
}
