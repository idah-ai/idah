import type { Snippet } from "svelte";

import type { PickedFile } from "@/components/app/forms/fields/upload/file-upload.utils";

export interface FileUploadBaseProps {
  class?: string | null;
  acceptedFileTypes?: string[] | null;
  // Also offer picking/dropping whole folders (flattened at any depth).
  allowFolders?: boolean;

  onFilesSelected: (selectedFiles: PickedFile[]) => Promise<void> | void;

  SelectedFilesSlot?: Snippet<[{ selectedFiles: PickedFile[] | null }]>;
  InfoSlot?: Snippet;
}
