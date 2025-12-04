import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { AccountRecord } from "@/data/model/iam/accounts/record";

import { parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";

import type { JsonApiErrorResponse, RecordResponse } from "@/data/model/types";
import type { Hash } from "@/utils/types";

const accountPasswordsBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/iam/account/passwords`;

export const accountPasswordsBackendDataSource = createBackendDataSource(AccountRecord, accountPasswordsBasePath, {
  request_reset: async (params: { email: string }): Promise<void | JsonApiErrorResponse> => {
    const res = await fetch(`${accountPasswordsBasePath}/request_reset`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          attributes: {
            email: params.email,
          },
        },
      }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    const body = await res.json();
    // Cache Management
    const cacheIndexKey = resourcePath(accountPasswordsBasePath, null, undefined);
    // Note: Clear dataset cache as well to update progress at DataTable
    const cacheDatasetIndexKey = resourcePath(accountPasswordsBasePath, null, undefined);
    clearCache(cacheIndexKey);
    clearCache(cacheDatasetIndexKey);

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error submitting entry: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body && body.data) {
      // return Promise.resolve(parseSingleElementReturn<AccountRecord>(body));
    }

    throw "No data returned";
  },
  reset: async (params: {
    token: string;
    password: string;
  }): Promise<RecordResponse<AccountRecord> | JsonApiErrorResponse> => {
    const res = await fetch(`${accountPasswordsBasePath}/reset`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          attributes: {
            token: params.token,
            password: params.password,
          },
        },
      }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });
    const body = await res.json();
    // Cache Management
    const cacheIndexKey = resourcePath(accountPasswordsBasePath, null, undefined);
    // Note: Clear dataset cache as well to update progress at DataTable
    const cacheDatasetIndexKey = resourcePath(accountPasswordsBasePath, null, undefined);
    clearCache(cacheIndexKey);
    clearCache(cacheDatasetIndexKey);

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error submitting entry: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body && body.data) {
      return Promise.resolve(parseSingleElementReturn<AccountRecord>(body));
    }

    throw "No data returned";
  },
  token_valid: async (params: { token: string }): Promise<void | JsonApiErrorResponse> => {
    const res = await fetch(`${accountPasswordsBasePath}/token_valid?token=${encodeURIComponent(params.token)}`, {
      method: "GET",
    });
    const body = await res.json();

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error submitting entry: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body && body.data) {
      // return Promise.resolve();
    }

    throw "No data returned";
  },
});
