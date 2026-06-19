import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { parseSingleElementError, parseCollectionReturn, parseSingleElementReturn } from "@/data/model/json_api";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { showErrorToast } from "@/utils/error/error.toasts";

import type { CollectionResponse, JsonApiErrorResponse, JsonApiMeta, RecordResponse } from "@/data/model/types";
import type { Hash } from "@/utils/types";

// A file the backend did not turn into a media record: either intentionally
// skipped (e.g. unsupported type) or failed to store. Same shape for both.
export interface UploadIssueFile {
  filename: string;
  message: string;
}

// Upload response, narrowing `meta` to the skipped/errored lists the backend
// reports when extracting a zip archive.
export type MediaUploadResponse = Omit<CollectionResponse<MediaRecord>, "meta"> & {
  meta?: JsonApiMeta & {
    skipped?: UploadIssueFile[];
    errored?: UploadIssueFile[];
  };
};

@type("media:medias")
export class MediaRecord extends Record {
  @field() public resource!: string;
  @field() public key!: string;

  @field() public size!: number;
  @field() public mime_type!: string;

  @field() public filename!: string;
  @field() public meta!: { [key: string]: unknown };

  @field() public created_by!: number;
  @field() public created_at!: Date;
  @field() public updated_at!: Date;
}

RecordFactory.registerTypes(MediaRecord);

export const mediaBasePath = `${import.meta.env.VITE_IDAH_HOST}/api/v1/media/medias`;

export const mediaBackendDataSource = createBackendDataSource(MediaRecord, mediaBasePath, {
  getInfo: async (param: {
    resource: string;
    key?: string;
  }): Promise<RecordResponse<MediaRecord> | JsonApiErrorResponse> => {
    const { resource, key } = param;
    let mediaInfoUrl = `${mediaBasePath}/info/${resource}`;

    if (key) {
      mediaInfoUrl = `${mediaInfoUrl}/${key}`;
    }

    return await fetch(mediaInfoUrl, {
      method: "GET",
    })
      .then(
        (res) => res.json(),
        (err) => {
          console.error("Failed to fetch media info:", err);
          throw err;
        },
      )
      .then((body) => {
        if (body && body.errors) {
          if (body.errors.length > 0) {
            body.errors.forEach((err: Hash<string>) => {
              showErrorToast({ title: err.title, message: err.detail, error: err });
            });
          }

          throw parseSingleElementError({ status: 500, errors: body.errors });
        }

        if (body && body.data) return Promise.resolve(parseSingleElementReturn<MediaRecord>(body));

        throw new Error("No data returned");
      });
  },
  getFiles: async (params: { resource: string; key?: string }): Promise<string> => {
    const { resource, key } = params;
    const getFilesPath = key ? `${mediaBasePath}/files/${resource}/${key}` : `${mediaBasePath}/files/${resource}`;
    const response = await fetch(getFilesPath, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    // Convert ReadableStream to Blob
    const blob = await response.blob();

    // Create a blob URL that can be used in an <img> tag
    const blobUrl = URL.createObjectURL(blob);
    return blobUrl;
  },

  // Upload always returns a collection — a single-element array for regular files,
  // or a multi-element array when the uploaded file is a zip archive.
  upload: async (
    file: File,
    resource: string,
    project_id: string,
    key: string = "",
    modality?: string,
  ): Promise<MediaUploadResponse | JsonApiErrorResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_id", project_id);
    if (modality) formData.append("modality", modality);

    const uploadPath = key ? `${mediaBasePath}/files/${resource}/${key}` : `${mediaBasePath}/files/${resource}`;

    const out = await fetch(uploadPath, {
      method: "POST",
      body: formData,
    });

    const body = await out.json();

    // Cache Management
    const cacheIndexKey = resourcePath(mediaBasePath, null, undefined);
    clearCache(cacheIndexKey);

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash<string>) => {
          showErrorToast({ title: err.title, message: err.detail, error: err });
        });
      }

      return Promise.reject(parseSingleElementError({ status: out.status, errors: body.errors }));
    }

    // `meta` is narrowed to the upload-specific shape at this single boundary;
    // the generic parser types it as the open-ended JsonApiMeta.
    if (body && body.data) return Promise.resolve(parseCollectionReturn<MediaRecord>(body) as MediaUploadResponse);

    throw "No data returned";
  },
});
