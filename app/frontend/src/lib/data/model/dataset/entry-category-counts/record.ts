import { field, Record, RecordFactory, type } from "@/data/model/Record";

@type("dataset:entry_category_counts")
export class EntryCategoryCountRecord extends Record {
  @field() public readonly entry_id!: string;
  @field() public readonly dataset_id!: string;
  @field() public readonly project_id!: string;
  @field() public readonly category!: string;
  @field() public readonly count!: number;
}

RecordFactory.registerTypes(EntryCategoryCountRecord);
