import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";

// One "Select …" button, with what it does shown on hover.
export interface FileUploadPicker {
  kind: "files" | "folder";
  label: string;
  description?: string; // shown on hover; leave it out where a help topic explains the pickers
  // Narrows what a "files" dialog offers; defaults to acceptedFileTypes.
  accept?: string[];
}

export interface FileUploadBaseProps {
  class?: string | null;
  // Filters everything picked or dropped, including the contents of folders.
  acceptedFileTypes?: string[] | null;
  // Shown in this order; a "folder" picker also makes dropped folders get walked.
  pickers: FileUploadPicker[];
  dropHint: string;

  // `ignored` = picked/dropped files that were not accepted
  onFilesSelected: (selectedFiles: PickedFile[], ignored: PickedFile[]) => Promise<void> | void;
}
