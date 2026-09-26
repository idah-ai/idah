import { createBackendDataSource } from "@/data/BackendDataSource";
import { createMemoryDataSource } from "@/data/MemoryDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

@type("notification:webhooks")
export class WebhookRecord extends Record {
  @field() public name!: string;
  @field() public url!: string;
  @field() public event_types!: string[];
  @field() public secret_key!: string;
  @field() public enabled!: boolean;
  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;
}

RecordFactory.registerTypes(WebhookRecord);

export const webhooksBackendDataSource = createBackendDataSource(
  WebhookRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/notification/webhooks`,
);

export const webhooksMemoryDataSource = createMemoryDataSource(WebhookRecord, {
  initialData: [
    {
      id: 1,
      name: "Annotation Created",
      url: "https://example.com/webhooks/annotations-created",
      event_types: ["annotation.created"],
      secret_key: "whsec_annotation_created",
      enabled: true,
      created_at: "2026-09-12T08:30:00.000Z",
      updated_at: "2026-09-18T11:15:00.000Z",
    },
    {
      id: 2,
      name: "Dataset Export Ready",
      url: "https://example.com/webhooks/dataset-export-ready",
      event_types: ["dataset.export.ready"],
      secret_key: "whsec_dataset_export_ready",
      enabled: true,
      created_at: "2026-09-10T04:45:00.000Z",
      updated_at: "2026-09-20T06:05:00.000Z",
    },
    {
      id: 3,
      name: "Project Member Changed",
      url: "https://example.com/webhooks/project-member-changed",
      event_types: ["project.member.changed"],
      secret_key: "whsec_project_member_changed",
      enabled: false,
      created_at: "2026-08-28T13:20:00.000Z",
      updated_at: "2026-09-01T09:10:00.000Z",
    },
    {
      id: 4,
      name: "Entry Review Completed",
      url: "https://example.com/webhooks/entry-review-completed",
      event_types: ["entry.review.completed"],
      secret_key: "whsec_entry_review_completed",
      enabled: true,
      created_at: "2026-08-21T02:25:00.000Z",
      updated_at: "2026-09-14T14:40:00.000Z",
    },
    {
      id: 5,
      name: "Sync Failed",
      url: "https://example.com/webhooks/sync-failed",
      event_types: ["sync.failed", "sync.completed", "sync.started"],
      secret_key: "whsec_sync_failed",
      enabled: false,
      created_at: "2026-08-03T16:00:00.000Z",
      updated_at: "2026-08-30T07:35:00.000Z",
    },
  ],
});
