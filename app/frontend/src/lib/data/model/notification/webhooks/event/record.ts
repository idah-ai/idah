import { field, Record, RecordFactory, type } from "@/data/model/Record";

@type("notification:webhook_events")
export class WebhookEventRecord extends Record {
  @field() public event!: string;
  @field() public label!: string;
  @field() public description!: string;
  @field() public allowed_roles!: string[];
}

RecordFactory.registerTypes(WebhookEventRecord);
