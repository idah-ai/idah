import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import type { Hash } from "@/utils/types";
import { parseSingleElementError } from "@/data/model/json_api";

@type("setting:plugins")
export class PluginRecord extends Record {
  @field() public source_type!: string;
  @field() public source_path!: string;
  @field() public name!: string;
  @field() public description!: string;
  @field() public version!: string;
  @field() public created_at!: Date;
  @field() public updated_at!: Date;
}

RecordFactory.registerTypes(PluginRecord);

const base_path = `${import.meta.env.VITE_IDAH_HOST}/api/v1/setting/plugins`;

export const pluginsBackendDataSource = createBackendDataSource(PluginRecord, base_path, {
  modalities: async (): Promise<Hash> => {
    console.warn(`${base_path}/modalities`);
    const res = await fetch(`${base_path}/modalities`);

    const body = await res.json();

    // Cache Management
    const cacheIndexKey = resourcePath(base_path, null, undefined);
    clearCache(cacheIndexKey);

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`modalities error: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body && body.data) {
      return Promise.resolve(body.data);
    }

    throw "No data returned";
  },
});
