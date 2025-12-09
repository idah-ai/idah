import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { AccountRecord } from "@/data/model/iam/accounts/record";

import { parseSingleElementError } from "@/data/model/json_api";

import type { JsonApiErrorResponse } from "@/data/model/types";
import type { Hash } from "@/utils/types";

const accountPasswordsBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/iam/account/passwords`;

export const accountPasswordsBackendDataSource = createBackendDataSource(AccountRecord, accountPasswordsBasePath, {
  request_reset: async (params: { email: string }): Promise<void | JsonApiErrorResponse> => {
    const response = await fetch(`${accountPasswordsBasePath}/request_reset`, {
      method: "POST",
      body: JSON.stringify({
        email: params.email,
      }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    // Cache Management
    const cacheIndexKey = resourcePath(accountPasswordsBasePath, null, undefined);
    // Note: Clear dataset cache as well to update progress at DataTable
    const cacheDatasetIndexKey = resourcePath(accountPasswordsBasePath, null, undefined);
    clearCache(cacheIndexKey);
    clearCache(cacheDatasetIndexKey);

    if (!response.ok) {
      const body = await response.json();
      return Promise.reject(parseSingleElementError({ status: response.status, errors: body.errors }));
    }

    if (response.ok) {
      return Promise.resolve();
    }
  },
  reset: async (params: { token: string; password: string }): Promise<void | JsonApiErrorResponse> => {
    const res = await fetch(`${accountPasswordsBasePath}/reset`, {
      method: "POST",
      body: JSON.stringify({
        token: params.token,
        password: params.password,
      }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });
    // Cache Management
    const cacheIndexKey = resourcePath(accountPasswordsBasePath, null, undefined);
    // Note: Clear dataset cache as well to update progress at DataTable
    const cacheDatasetIndexKey = resourcePath(accountPasswordsBasePath, null, undefined);
    clearCache(cacheIndexKey);
    clearCache(cacheDatasetIndexKey);

    if (!res.ok) {
      const body = await res.json();
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error submitting entry: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    return Promise.resolve();
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
  change_password: async (params: { oldPassword: string; newPassword: string }) => {},
});
