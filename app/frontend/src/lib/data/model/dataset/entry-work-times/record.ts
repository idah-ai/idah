import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

/** Per-stint rolled-up time for an entry (from the `entry_work_times` relation). */
@type("dataset:entry_work_times")
export class EntryWorkTimeRecord extends Record {
  @field() public readonly account_id!: number;
  @field() public readonly wf_step!: string;
  @field() public readonly seconds!: number;
  @field() public readonly email!: string | null;
  @field({ transformer: Transformers.Time })
  public readonly session_started_at!: Date | null;
}

RecordFactory.registerTypes(EntryWorkTimeRecord);