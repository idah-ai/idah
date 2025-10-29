import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { createBackendDataSource } from "@/data/BackendDataSource";

@type("setting:settings")
export class SettingRecord extends Record {
  @field() public key!: string;
  @field() public value!: any;
}

RecordFactory.registerTypes(SettingRecord);

export const settingsBackendDataSource = createBackendDataSource(
  SettingRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/setting/settings`,
);
