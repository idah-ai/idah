import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { parseCollectionReturn, parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";
import { showErrorToast } from "@/utils/error/error.toasts";

import type { CollectionResponse, JsonApiErrorResponse, JsonApiMeta, RecordResponse } from "@/data/model/types";
import type { Hash } from "@/utils/types";

export interface ZipFileReport {
  filename: string;
  message: string;
}

// Upload response, narrowing `meta` to the skipped/errored lists the backend
// reports when extracting a zip archive.
export type MediaUploadResponse = Omit<CollectionResponse<MediaRecord>, "meta"> & {
  meta?: JsonApiMeta & {
    skipped?: ZipFileReport[];
    errored?: ZipFileReport[];
  };
};

@type("media:medias")
export class MediaRecord extends Record {
  @field() public resource!: string;
  @field() public key!: string;

  @field() public filename!: string;

  @field() public size!: number;
  @field() public mime_type!: string;

  @field() public created_by!: number;
  @field() public created_role!: string;

  @field() public public!: boolean;

  @field() public meta!: Hash;

  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;

  @field() public readonly project_id!: string;
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
  upload: async (props: {
    file: File;
    resource: string;
    projectId: string;
    key?: string;
    modality?: string;
  }): Promise<MediaUploadResponse | JsonApiErrorResponse> => {
    const { file, resource, projectId, key = "", modality } = props;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_id", projectId);
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
