import { clearCache, getCache, setCache } from "@/data/Cache";

import { filtersToHash } from "@/data/filtering";
import { parseCollectionReturn, parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";
import { showErrorToast } from "@/utils/error/error.toasts";
import { generateHash } from "@/utils/string";
import { identity, type Hash } from "@/utils/types";
import { encodeUri } from "@/utils/uri";

import type { CacheValue } from "@/data/Cache.types";
import type { DataParams, DataSource, DataSourceOptions, GetOptions, ListOptions } from "@/data/DataSource";
import type { Record, RecordClass } from "@/data/model/Record";
import type { CollectionResponse, JsonApiErrorResponse, RecordResponse } from "@/data/model/types";

export function encodeModel<T extends Record>(model: RecordClass<T>, data: DataParams<T>): string {
  const attributes: Hash = {};

  Object.entries(model.fields || {}).forEach(([name, field]) => {
    const value = data.attributes[name];

    if (value !== undefined) {
      const transformer = field.transformer?.to || identity;
      attributes[field.key || name] = transformer(value);
    }
  });

  const payload: Hash = {
    data: { type: model.type },
  };

  if (data.attributes.id) {
    payload.data.id = data.attributes.id;
  }

  payload.data.attributes = attributes;
  payload.data.relationships = data.relationships;

  return JSON.stringify(payload);
}

export function resourcePath(basePath: string, id: string | null, queryPath?: Hash): string {
  let uri = id ? `${basePath}/${id}` : basePath;

  if (queryPath) {
    uri += `?${encodeUri(queryPath)}`;
  }

  return uri;
}

export interface BackendDataSource<T extends Record> extends DataSource<T> {
  recordClass: RecordClass<T>;
  basePath: string;
}

export function createBackendDataSource<T extends Record, CustomMethods>(
  recordClass: RecordClass<T>,
  basePath: string,
  customMethods?: CustomMethods,
): BackendDataSource<T> & CustomMethods {
  let obj = <BackendDataSource<T> & CustomMethods>{
    recordClass: recordClass,
    basePath: basePath,

    async create(data: DataParams<T>, options?: DataSourceOptions): Promise<RecordResponse<T> | JsonApiErrorResponse> {
      const out = await fetch(this.basePath, {
        method: "POST",
        body: encodeModel(this.recordClass, data),
        headers: { "Content-Type": "application/vnd.api+json" },
      });

      const body = await out.json();

      // Cache Management
      const cacheIndexKey = resourcePath(this.basePath, null, undefined);
      clearCache(cacheIndexKey);

      if (body && body.errors) {
        if (body.errors.length > 0 && options?.showErrorToast !== false) {
          body.errors.forEach((err: Hash<string>) => {
            showErrorToast({ title: err.title, message: err.detail, error: err });
          });
        }

        return Promise.reject(parseSingleElementError({ status: out.status, errors: body.errors }));
      }

      if (body && body.data) return Promise.resolve(parseSingleElementReturn<T>(body));

      throw "No id returned";
    },

    async get(id: string, options: GetOptions = {}): Promise<RecordResponse<T>> {
      const params = <Hash>{};
      let body: Hash;

      // Params Management
      if (options.included) params["included"] = options.included;
      if (options.fields) params["fields"] = options.fields;

      // Cache Management
      const useCache = !options.noCache;
      const queryObj = JSON.stringify(params);

      let cacheIdKey: string = "";
      let cacheSignature: string = "";
      let cacheValue: CacheValue | undefined = undefined;

      if (useCache) {
        cacheIdKey = resourcePath(this.basePath, id, undefined);
        cacheSignature = await generateHash(queryObj);
        cacheValue = getCache(cacheIdKey, cacheSignature);
      }

      if (cacheValue) {
        body = cacheValue;
      } else {
        const out = await fetch(resourcePath(this.basePath, id, params), {
          method: "GET",
        });

        body = await out.json();

        if (body && body.errors) {
          return Promise.reject(parseSingleElementError({ status: out.status, errors: body.errors }));
        }
      }

      if (useCache) {
        setCache(cacheIdKey, cacheSignature, body);
      }

      if (body) return parseSingleElementReturn<T>(body);

      throw "No body returned";
    },

    async list(
      options: ListOptions = {},
      nextBody: CollectionResponse<T> = { data: [], meta: {} },
    ): Promise<CollectionResponse<T>> {
      const params = <Hash>{};
      let body: Hash;

      // Params Management
      if (options.filters) params["filter"] = filtersToHash(options.filters);
      if (options.fields) params["fields"] = options.fields;
      if (options.included) params["included"] = options.included;
      if (options.sort) params["sort"] = options.sort.join(",");
      if (options.pagination) {
        params["page"] = {
          number: options.pagination.page,
          size: options.pagination.itemsPerPage,
        };
      }
      if (options.count) params["count"] = options.count;

      // Cache Management
      const useCache = !options.noCache;
      const queryObj = JSON.stringify(params);

      let cacheIndexKey: string = "";
      let cacheSignature: string = "";
      let cacheValue: CacheValue | undefined = undefined;

      if (useCache) {
        cacheIndexKey = resourcePath(this.basePath, null, undefined);
        cacheSignature = await generateHash(queryObj);
        cacheValue = getCache(cacheIndexKey, cacheSignature);
      }

      if (cacheValue) {
        body = cacheValue;
      } else {
        const out = await fetch(resourcePath(this.basePath, null, params), {
          method: "GET",
        });

        body = await out.json();

        if (nextBody.data.length > 0) {
          body.data = nextBody.data.concat(body.data);
        }

        if (options.all) {
          const nextPage = body.links?.next;

          if (nextPage && options.pagination) {
            return await this.list({
              ...options,
              pagination: {
                page: options.pagination.page + 1,
                itemsPerPage: options.pagination.itemsPerPage,
              },
            });
          }
        }

        if (useCache) {
          setCache(cacheIndexKey, cacheSignature, body);
        }
      }

      if (body) return parseCollectionReturn<T>(body);

      throw "No body returned";
    },

    async update(
      id: string,
      data: DataParams<T>,
      options?: DataSourceOptions,
    ): Promise<RecordResponse<T> | JsonApiErrorResponse> {
      // Cache Management
      const cacheIndexKey = resourcePath(this.basePath, null, undefined);
      const cacheIdKey = resourcePath(this.basePath, id, undefined);
      clearCache(cacheIndexKey);
      clearCache(cacheIdKey);

      const out = await fetch(resourcePath(this.basePath, id), {
        method: "PATCH",
        body: encodeModel(this.recordClass, data),
        headers: { "Content-Type": "application/vnd.api+json" },
      });

      const body = await out.json();

      if (body && body.errors) {
        if (body.errors.length > 0 && options?.showErrorToast !== false) {
          body.errors.forEach((err: Hash<string>) => {
            showErrorToast({ title: err.title, message: err.detail, error: err });
          });
        }

        return Promise.reject(parseSingleElementError({ status: out.status, errors: body.errors }));
      }

      if (body && body.data) return Promise.resolve(parseSingleElementReturn<T>(body));

      throw "No body returned";
    },

    async delete(id: string, options?: DataSourceOptions): Promise<boolean> {
      const response = await fetch(resourcePath(this.basePath, id), { method: "DELETE" });

      if (!response.ok) {
        const body = await response.json();

        if (body && body.errors) {
          if (body.errors.length > 0 && options?.showErrorToast !== false) {
            body.errors.forEach((err: Hash<string>) => {
              showErrorToast({ title: err.title, message: err.detail, error: err });
            });
          }

          return Promise.reject(parseSingleElementError({ status: response.status, errors: body.errors }));
        }
      }

      // Cache Management
      const cacheIndexKey = resourcePath(this.basePath, null, undefined);
      const cacheIdKey = resourcePath(this.basePath, id, undefined);
      clearCache(cacheIndexKey);
      clearCache(cacheIdKey);

      return true;
    },
  };

  obj = Object.assign(obj, customMethods || {});
  return obj;
}
