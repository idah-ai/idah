import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";
import { field, Record, RecordFactory, type } from "@/data/model/Record";

import type { Hash } from "@/utils/types";

export const accountSettingsType = "setting:account_settings";

@type(accountSettingsType)
export class AccountSettingRecord extends Record {
  @field() public account_id!: string;
  @field() public key!: string;
  @field() public plugin!: string;
  @field() public value!: Hash | [] | string | number | boolean | null | undefined;
}

RecordFactory.registerTypes(AccountSettingRecord);

export const organizationActivitiesKey = "notification:organization:activities";
export const projectActivitiesKey = "notification:project:activities";
export const commandShortcutKey = "command:shortcut";

export const accountSettingsBasePath = `${import.meta.env.VITE_IDAH_HOST}/api/v1/setting/account_settings`;

export const accountSettingBackendDataSource = createBackendDataSource(AccountSettingRecord, accountSettingsBasePath, {
  // Create-or-update a setting by its natural key (account_id is derived
  // server-side from the auth context, never sent). This is the single write
  // path for every account setting — no update-by-id, and new settings need no
  // backfill since the row is created on first write. Mirrors the noteFeeds
  // custom-write shape (parse + return the record, invalidate the list cache).
  upsert: async (key: string, value: AccountSettingRecord["value"], plugin = "") => {
    const res = await fetch(`${accountSettingsBasePath}/upsert`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: accountSettingsType,
          attributes: { key, plugin, value },
        },
      }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    const body = await res.json();

    clearCache(resourcePath(accountSettingsBasePath, null, undefined));

    if (body && body.errors) {
      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body && body.data) {
      return Promise.resolve(parseSingleElementReturn<AccountSettingRecord>(body));
    }

    throw "No data returned";
  },
});
