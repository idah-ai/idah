import { showToast } from "@/components/ui/toast/index.svelte";
import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
import { mediaBackendDataSource } from "@/data/model/media/medias/medias-record";

import type { UploadItem } from "./upload-item.types";
import type { JsonApiErrorResponse } from "@/data/model/types";

export interface UploadContext {
  projectId: string;
  modality: string;
  // Called only once an upload produced media, so a dataset can be created lazily.
  getDatasetId: () => Promise<string>;
}

export const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 2_000;
const MAX_DELAY_MS = 30_000;

export function acceptedFileTypes(modality: string | null | undefined): string[] {
  switch (modality) {
    case "idah-video": {
      return [".zip", ".mp4", ".mkv", ".3gp", ".avi", ".m4v", ".mov", ".webm", ".ts"];
    }
    case "idah-image": {
      return [".zip", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"];
    }
    default: {
      return [];
    }
  }
}

// Memoizes an async factory; a rejection is forgotten so the next call retries.
export function once<T>(factory: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= factory().catch((error) => {
      pending = null;
      throw error;
    });
    return pending;
  };
}

export function sumBy<T>(items: T[], fn: (item: T) => number): number {
  return items.reduce((total, item) => total + fn(item), 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(attempt: number): number {
  const base = Math.min(INITIAL_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  const jitter = base * 0.25 * (Math.random() * 2 - 1); // ±25%
  return base + jitter;
}

function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : "";
}

export async function uploadSingleMedia(media: UploadItem, context: UploadContext): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      media.status = "retrying";
      media.retryCount = attempt;
      await sleep(retryDelay(attempt - 1));
    }

    try {
      if (media.uploadedMedias.length === 0) {
        const fileExtension = getFileExtension(media.media.name);
        const resourceKey = `${media.uuid}${fileExtension}`;

        const createdMedias = await mediaBackendDataSource.upload({
          file: media.media,
          resource: resourceKey,
          projectId: context.projectId,
          key: "",
          modality: context.modality,
        });

        if (!("data" in createdMedias)) throw new Error("Media upload failed");

        media.uploadedMedias = createdMedias.data;

        if (createdMedias.meta?.skipped) {
          for (const skippedFile of createdMedias.meta.skipped) {
            media.skippedMedias.push(skippedFile);
          }
        }

        if (createdMedias.meta?.errored) {
          for (const erroredFile of createdMedias.meta.errored) {
            media.errorMedias.push(erroredFile);
          }
        }
      }

      const pendingMedias = media.uploadedMedias.slice(media.createdEntryCount);
      if (pendingMedias.length > 0) {
        const datasetId = await context.getDatasetId();

        for (const uploadedMedia of pendingMedias) {
          await entriesBackendDataSource.create(
            {
              attributes: { resource: uploadedMedia.resource, name: uploadedMedia.filename, status: "pending" },
              relationships: { dataset: { data: { type: "datasets:datasets", id: datasetId } } },
            },
            { showErrorToast: false },
          );
          media.createdEntryCount++;
        }
      }

      media.errorMessage = undefined;
      media.status = "completed";
      return; // done
    } catch (error) {
      const apiError = error as JsonApiErrorResponse;
      media.errorMessage = apiError?.errors?.[0]?.detail ?? apiError?.errors?.[0]?.title ?? "Upload failed";
      if (media.isZip) {
        media.errorMedias.push({ filename: media.media.name, message: media.errorMessage });
      }
    }
  }

  media.status = "completed"; // exhausted retries, process finished
}

export async function uploadAll(items: UploadItem[], context: UploadContext): Promise<void> {
  for (const item of items) {
    await uploadSingleMedia(item, context); // never throws — loop always continues
  }
}

// Returns the number of entries created.
export function showUploadSummaryToast(items: UploadItem[]): number {
  const itemsWithErrors = items.filter((i) => i.errorMessage).length;
  const itemsWithSkips = items.filter((i) => i.skippedMedias.length > 0).length;
  const totalCreated = sumBy(items, (i) => i.createdEntryCount);
  const totalSkipped = sumBy(items, (i) => i.skippedMedias.length);

  if (itemsWithErrors === 0 && itemsWithSkips === 0) {
    showToast.success({ title: `${totalCreated} entries created successfully.` });
  } else if (totalCreated > 0) {
    const parts = [`${totalCreated} entries created`];
    if (totalSkipped > 0) parts.push(`${totalSkipped} skipped`);
    if (itemsWithErrors > 0) parts.push(`${itemsWithErrors} failed`);
    showToast.warning({ title: parts.join(", ") });
  } else {
    showToast.error({ title: "All uploads failed." });
  }

  return totalCreated;
}
