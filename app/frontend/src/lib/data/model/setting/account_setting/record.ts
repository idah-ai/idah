import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";

import type { Hash } from "@/utils/types";

@type("setting:account_settings")
export class AccountSettingRecord extends Record {
  @field() public account_id!: string;
  @field() public key!: string;
  @field() public plugin!: string;
  @field() public value!: Hash | [] | string | number | boolean | null | undefined;
}

RecordFactory.registerTypes(AccountSettingRecord);

export const orgOwnershipAssignedKey = "notification:organization:ownership.assigned";
export const orgOwnershipUnassignedKey = "notification:organization:ownership.unassigned";
export const projectMemberInvitedKey = "notification:project:member.invited";
export const projectMemberRemovedKey = "notification:project:member.removed";
export const datasetCompletedKey = "notification:dataset.completed";

export const accountSettingBackendDataSource = createBackendDataSource(
  AccountSettingRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/setting/account_settings`,
);
