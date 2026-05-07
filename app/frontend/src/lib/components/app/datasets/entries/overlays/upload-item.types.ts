import type { MediaRecord } from "@/data/model/media/medias/medias-record";

export interface UploadItem {
  uuid: string;
  media: File;
  name: string;
  isZip(): boolean;
  uploadedMedias: Array<MediaRecord>; // set once media upload succeeds — skip on retry
  skippedMedias: Array<string>;
  status: "uploading" | "retrying" | "success" | "error" | "skipped" | "archive";
  retryCount: number; // auto-retry attempts consumed
  errorMessage?: string; // last error for display
  isUploaded(): boolean;
}
