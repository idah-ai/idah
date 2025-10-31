import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { createBackendDataSource } from "@/data/BackendDataSource";
import type { Hash } from "@/utils/types";

@type("setting:settings")
export class SettingRecord extends Record {
  @field() public key!: string;
  @field() public value!: Hash | [] | string | number | boolean | null | undefined;
}

RecordFactory.registerTypes(SettingRecord);

export const settingsBackendDataSource = createBackendDataSource(
  SettingRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/setting/settings`,
);
