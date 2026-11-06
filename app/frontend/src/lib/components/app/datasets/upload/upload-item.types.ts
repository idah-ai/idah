import type { MediaRecord, ZipFileReport } from "@/data/model/media/medias/medias-record";

export interface UploadItem {
  uuid: string;
  media: File;
  name: string;
  path: string; // relative to the picked folder ("clip/1.jpg"); used when reporting the file
  uploadedMedias: Array<MediaRecord>; // set once media upload succeeds — skip on retry
  skippedMedias: Array<ZipFileReport>;
  errorMedias: Array<ZipFileReport>; // per-file errors reported by the backend when processing a zip archive
  isZip: boolean;
  isFolder?: boolean; // a folder summary row (see upload-rows.ts)
  status: "uploading" | "retrying" | "completed";
  retryCount: number; // auto-retry attempts consumed
  createdEntryCount: number; // entries already persisted — used to resume partial entry creation on retry
  errorMessage?: string; // last error for display
}

export function createUploadItem(file: File, path: string = file.name): UploadItem {
  return {
    uuid: crypto.randomUUID().replace(/-/g, "").substring(0, 16),
    name: file.name,
    path,
    media: file,
    isZip: file.name.toLowerCase().endsWith(".zip"),
    status: "uploading",
    retryCount: 0,
    createdEntryCount: 0,
    uploadedMedias: [],
    skippedMedias: [],
    errorMedias: [],
  };
}

// What a summary row renders: an upload item, or a folder summed up like a zip.
export type UploadItemView = Omit<UploadItem, "media">;
