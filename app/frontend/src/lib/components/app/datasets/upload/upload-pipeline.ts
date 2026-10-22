import { showToast } from "@/components/ui/toast/index.svelte";
import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
import { mediaBackendDataSource } from "@/data/model/media/medias/medias-record";
import { pluralizeUnit } from "@/utils/unit";

import type { UploadItem, UploadItemView } from "./upload-item.types";
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

// A failed dataset creation is permanent in practice (permission, validation), so it is
// never retried and stops the files still waiting for that dataset.
class DatasetCreationError extends Error {}

function errorMessageOf(error: unknown, fallback: string): string {
  const apiError = error as JsonApiErrorResponse;
  return apiError?.errors?.[0]?.detail ?? apiError?.errors?.[0]?.title ?? fallback;
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
        const datasetId = await context.getDatasetId().catch((error: unknown) => {
          throw new DatasetCreationError(errorMessageOf(error, "Dataset could not be created"));
        });

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
      if (error instanceof DatasetCreationError) {
        media.errorMessage = error.message;
        media.status = "completed";
        throw error; // no retry; uploadAll stops the remaining items
      }

      media.errorMessage = errorMessageOf(error, "Upload failed");
      if (media.isZip) {
        media.errorMedias.push({ filename: media.media.name, message: media.errorMessage });
      }
    }
  }

  media.status = "completed"; // exhausted retries, process finished
}

// ponytail: files go one at a time and every file is a rendered row; parallelize uploads
// (3-4 at once) and collapse/virtualize the lists if 1,000+ file batches get slow.
export async function uploadAll(items: UploadItem[], context: UploadContext): Promise<void> {
  for (const [index, item] of items.entries()) {
    try {
      await uploadSingleMedia(item, context); // a failing file never stops the others…
    } catch (error) {
      if (!(error instanceof DatasetCreationError)) throw error;
      // …but without a dataset there is nothing to upload into
      for (const pending of items.slice(index + 1)) {
        pending.errorMessage = "Not uploaded: the dataset could not be created";
        pending.status = "completed";
      }
      return;
    }
  }
}

// Returns the number of entries created. `datasetsCreated` is set when the upload created datasets.
export function showUploadSummaryToast(items: UploadItemView[], datasetsCreated?: number): number {
  const itemsWithErrors = items.filter((i) => i.errorMessage || i.errorMedias.length > 0).length;
  const itemsWithSkips = items.filter((i) => i.skippedMedias.length > 0).length;
  const totalCreated = sumBy(items, (i) => i.createdEntryCount);
  const totalSkipped = sumBy(items, (i) => i.skippedMedias.length);
  const datasets =
    datasetsCreated === undefined ? "" : `${datasetsCreated} ${pluralizeUnit(datasetsCreated, "dataset")}, `;

  if (itemsWithErrors === 0 && itemsWithSkips === 0) {
    showToast.success({ title: `${datasets}${totalCreated} entries created successfully.` });
  } else if (totalCreated > 0) {
    const parts = [`${datasets}${totalCreated} entries created`];
    if (totalSkipped > 0) parts.push(`${totalSkipped} skipped`);
    if (itemsWithErrors > 0) parts.push(`${itemsWithErrors} failed`);
    showToast.warning({ title: parts.join(", ") });
  } else {
    showToast.error({ title: "All uploads failed." });
  }

  return totalCreated;
}
