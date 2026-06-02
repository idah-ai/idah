import { NoteFeedRecord, noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";
import type { IFilter, INoteRecord, INotesDriverV2 } from "../types";
import type { RecordResponse } from "@/data/model/types";

function noteFeedToV2(rec: NoteFeedRecord): INoteRecord {
  return {
    id: rec.id,
    annotation_id: rec.annotation_id,
    content_md: rec.content_md,
    status: rec.status,
    anchor_type: rec.anchor_type,
    position: rec.position,
    created_by_email: rec.created_by_email,
    created_at: rec.created_at?.toString(),
    updated_at: rec.updated_at?.toString(),
    edited_at: rec.edited_at?.toString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Adapter: notes — BackendDataSource (NoteFeeds)
// ---------------------------------------------------------------------------
export class NotesDriverAdapter implements INotesDriverV2 {
  private virtualFields = new Map<string, (note: INoteRecord) => unknown>();

  registerField(name: string, fn: (note: INoteRecord) => unknown): void {
    this.virtualFields.set(name, fn);
  }

  async fetch(filter?: IFilter): Promise<INoteRecord[]> {
    const filters: Record<string, unknown> = {};
    if (filter) {
      for (const [key, val] of Object.entries(filter)) {
        if (typeof val === "object" && !Array.isArray(val)) {
          const op = val as Record<string, unknown>;
          if (op.eq !== undefined) filters[key] = op.eq;
          if (op.gt !== undefined) filters[`${key}__gt`] = op.gt;
          if (op.gte !== undefined) filters[`${key}__gte`] = op.gte;
          if (op.lt !== undefined) filters[`${key}__lt`] = op.lt;
          if (op.lte !== undefined) filters[`${key}__lte`] = op.lte;
          if (op.neq !== undefined) filters[`${key}__neq`] = op.neq;
        } else {
          filters[key] = val;
        }
      }
    }

    const res = await noteFeedsBackendDataSource.list({
      filters,
      noCache: true,
    });

    return res.data.map(noteFeedToV2);
  }

  async update(id: string, data: Partial<INoteRecord>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (data.content_md !== undefined) payload["content_md"] = data.content_md;
    if (data.status !== undefined) payload["status"] = data.status;
    if (data.position !== undefined) payload["position"] = data.position;

    await noteFeedsBackendDataSource.update(id, { attributes: payload });
  }

  async delete(id: string): Promise<void> {
    await noteFeedsBackendDataSource.delete(id);
  }

  async create(data: INoteRecord): Promise<INoteRecord> {
    const result = await noteFeedsBackendDataSource.create({
      attributes: {
        entry_id: (data as Record<string, unknown>).entry_id as string,
        annotation_id: data.annotation_id,
        content_md: data.content_md ?? "",
        anchor_type: data.anchor_type ?? "entry",
        position: data.position ?? {},
        status: data.status ?? "pending",
      },
    });

    const created = result as RecordResponse<NoteFeedRecord>;
    return noteFeedToV2(created.data);
  }
}
