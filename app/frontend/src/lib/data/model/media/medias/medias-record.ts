import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { showErrorToast } from "@/utils/error/error.toasts";
import { parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";

import type { Hash } from "@/utils/types";
import type { JsonApiErrorResponse, RecordResponse } from "@/data/model/types";

@type("media:medias")
export class MediaRecord extends Record {
  @field() public resource!: string;
  @field() public key!: string;

  @field() public size!: number;
  @field() public mime_type!: string;

  @field() public filename!: string;

  @field() public created_by!: number;
  @field() public created_at!: Date;
  @field() public updated_at!: Date;
}

RecordFactory.registerTypes(MediaRecord);

const mediaBasePath = `${import.meta.env.VITE_IDAH_HOST}/api/v1/media/medias`;

export const mediaBackendDataSource = createBackendDataSource(MediaRecord, mediaBasePath, {
  upload: async (
    file: File,
    resource: string,
    key: string = "",
  ): Promise<RecordResponse<MediaRecord> | JsonApiErrorResponse> => {
    const formData = new FormData();
    formData.append("file", file);

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

    if (body && body.data) return Promise.resolve(parseSingleElementReturn<MediaRecord>(body));

    throw "No data returned";
  },
});
