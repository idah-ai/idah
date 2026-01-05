import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import type { LogAction } from "@/data/model/audit/logs/constants";

@type("audit:logs")
export class LogRecord extends Record {
  @field() public readonly actor_account_id!: number;
  @field() public readonly actor_account_email!: string | null;

  @field() public readonly action!: LogAction;

  @field() public readonly resource_service!: string;
  @field() public readonly resource_type!: string;
  @field() public readonly resource_id!: string;

  @field() public readonly organization_id!: number | null;
  @field() public readonly project_id!: string | null;
  @field() public readonly dataset_id!: string | null;
  @field() public readonly entry_id!: string | null;

  @field({ transformer: Transformers.Time }) public readonly event_timestamp!: Date;

  @field({ transformer: Transformers.Time }) public readonly created_at!: Date;
}

RecordFactory.registerTypes(LogRecord);

const logBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/audit/logs`;

export const logsBackendDataSource = createBackendDataSource(LogRecord, logBasePath);
