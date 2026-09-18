// ── RPC client for annotation mutations ─────────────────────────────────

import { JsonRpcDatasource } from "@/data/jsonrpc";
import { annotationsBackendDataSource, type AnnotationRecord } from "@/data/model/dataset/annotations/record";
import type { IAnnotationRecord, IAnnotationsDriverV2, IFilter } from "../../types";
import type { ICrudDriver } from "./idb-driver";

// ── Helpers ──────────────────────────────────────────────────────────────

function annotationRecordToV2(rec: AnnotationRecord): IAnnotationRecord {
  return {
    id: rec.id,
    shape_type: rec.shape_type,
    shape_args: rec.shape_args as Record<string, unknown>,
    category: rec.category,
    properties: rec.properties as Record<string, unknown>,
    metadata: rec.metadata,
    deleted_at: rec.deleted_at,
    deleted_by_id: rec.deleted_by_id,
    created_by_id: rec.created_by_id,
    created_at: rec.created_at,
    updated_at: rec.updated_at,
  };
}

export function createBackendCrudDriver(entryId: string, rpc: JsonRpcDatasource): ICrudDriver<IAnnotationRecord> {
  return {
    async list(params): Promise<{ data: IAnnotationRecord[] }> {
      const filters: Record<string, unknown> = { ...params.filters };
      const res = await annotationsBackendDataSource.list({
        filters,
        pagination: params.pagination,
        sort: params.sort,
        noCache: true,
      });
      return { data: res.data.map(annotationRecordToV2) };
    },

    async create(record: IAnnotationRecord): Promise<IAnnotationRecord> {
      const result = await rpc.call({
        method: "create",
        params: {
          id: record.id,
          entry_id: entryId,
          shape_type: record.shape_type,
          shape_args: record.shape_args,
          category: record.category,
          properties: record.properties,
          metadata: record.metadata,
        },
      });
      return result as unknown as IAnnotationRecord;
    },

    async update(id: string, data: Partial<IAnnotationRecord>): Promise<void> {
      const payload: Record<string, unknown> = {};
      if (data.shape_type) payload["shape_type"] = data.shape_type;
      if (data.shape_args) payload["shape_args"] = data.shape_args;
      if (data.category) payload["category"] = data.category;
      if (data.properties) payload["properties"] = data.properties;
      if (data.metadata) payload["metadata"] = data.metadata;

      await rpc.call({
        method: "update",
        params: { id, entry_id: entryId, ...payload },
      });
    },

    async delete(id: string): Promise<void> {
      await rpc.call({
        method: "delete",
        params: { id, entry_id: entryId },
      });
    },

    async restore(id: string): Promise<IAnnotationRecord> {
      const result = await rpc.call({
        method: "restore",
        params: { id, entry_id: entryId },
      });
      return result as unknown as IAnnotationRecord;
    },

    async setShape(annotationId: string, key: string, value: object | null): Promise<void> {
      await rpc.call({
        method: "write_shape",
        params: { annotation_id: annotationId, key, value: value ?? null },
      });
    },

    async setShapes(annotationId: string, entries: Array<{ key: string; value: object | null }>): Promise<void> {
      await Promise.all(
        entries.map(({ key, value }) =>
          rpc.call({
            method: "write_shape",
            params: { annotation_id: annotationId, key, value: value ?? null },
          }),
        ),
      );
    },
  };
}

// ─── Fallback: direct backend annotations (when IDB is unavailable) ─────

/**
 * Fallback annotations driver used when IndexedDB is unavailable (SSR).
 * Also accepts the shared RPC instance for consistency — though in SSR
 * contexts this driver is typically replaced entirely.
 */
export class AnnotationsDriverAdapter implements IAnnotationsDriverV2 {
  private virtualFields = new Map<string, (ann: IAnnotationRecord) => unknown>();

  constructor(
    private entryId: string,
    private rpc: JsonRpcDatasource,
  ) {}

  registerField(name: string, fn: (ann: IAnnotationRecord) => unknown): void {
    this.virtualFields.set(name, fn);
  }

  async fetch(filter?: IFilter): Promise<IAnnotationRecord[]> {
    const filters: Record<string, unknown> = { deleted: "false" };
    if (filter) {
      for (const [key, val] of Object.entries(filter)) {
        if (key === "entry_id") {
          filters["entry_id"] = val;
        } else if (typeof val === "object" && !Array.isArray(val)) {
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

    const res = await annotationsBackendDataSource.list({ filters, noCache: true });
    return res.data.map(annotationRecordToV2);
  }

  async update(id: string, data: Partial<IAnnotationRecord>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (data.shape_type) payload["shape_type"] = data.shape_type;
    if (data.shape_args) payload["shape_args"] = data.shape_args;
    if (data.category) payload["category"] = data.category;
    if (data.properties) payload["properties"] = data.properties;
    if (data.metadata) payload["metadata"] = data.metadata;

    await this.rpc.call({ method: "update", params: { id, entry_id: this.entryId, ...payload } });
  }

  async delete(id: string): Promise<void> {
    await this.rpc.call({ method: "delete", params: { id, entry_id: this.entryId } });
  }

  async restore(id: string): Promise<IAnnotationRecord> {
    const result = await this.rpc.call({ method: "restore", params: { id, entry_id: this.entryId } });
    return result as unknown as IAnnotationRecord;
  }

  async create(data: IAnnotationRecord): Promise<IAnnotationRecord> {
    const result = await this.rpc.call({
      method: "create",
      params: {
        id: data.id,
        entry_id: this.entryId,
        shape_type: data.shape_type,
        shape_args: data.shape_args,
        category: data.category,
        properties: data.properties,
        metadata: data.metadata,
      },
    });
    return result as unknown as IAnnotationRecord;
  }

  async setShape(annotationId: string, key: string, value: object | null): Promise<void> {
    await this.rpc.call({
      method: "write_shape",
      params: { annotation_id: annotationId, key, value: value ?? null },
    });
  }

  async setShapes(annotationId: string, entries: Array<{ key: string; value: object | null }>): Promise<void> {
    await Promise.all(
      entries.map(({ key, value }) =>
        this.rpc.call({
          method: "write_shape",
          params: { annotation_id: annotationId, key, value: value ?? null },
        }),
      ),
    );
  }
}
