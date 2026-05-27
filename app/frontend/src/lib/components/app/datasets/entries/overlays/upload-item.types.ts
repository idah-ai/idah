import type { MediaRecord, SkippedFile } from "@/data/model/media/medias/medias-record";

export interface UploadItem {
  uuid: string;
  media: File;
  name: string;
  uploadedMedias: Array<MediaRecord>; // set once media upload succeeds — skip on retry
  skippedMedias: Array<SkippedFile>;
  status: "uploading" | "retrying" | "success" | "failed";
  retryCount: number; // auto-retry attempts consumed
  createdEntryCount: number; // entries already persisted — used to resume partial entry creation on retry
  errorMessage?: string; // last error for display
  isUploaded(): boolean;
}
