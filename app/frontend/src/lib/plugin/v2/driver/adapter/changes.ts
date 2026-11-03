// ---------------------------------------------------------------------------
// changes.ts — annotation change history for the annotations driver.
//
// A thin proxy over the backend annotation_changes endpoints. No local store:
// each call re-queries the backend, relying on the data source's existing
// cache. Both annotation drivers (the IDB driver and the fallback in
// annotationsBackendCrud.ts) delegate to it.
// ---------------------------------------------------------------------------

import type { IAnnotationChange, IChangesQuery, IChangesResult } from "../../types";
import {
  annotationChangesBackendDataSource,
  AnnotationChangeRecord,
} from "@/data/model/dataset/annotation_changes/record";
import { annotationsBackendDataSource, AnnotationRecord } from "@/data/model/dataset/annotations/record";

// Sparse fieldset: headers only, no `changes` payload.
const HEADER_FIELDS = {
  "dataset:annotation_changes": ["annotation_id", "account_id", "account_email", "op", "version", "changed_at"],
};

const DEFAULT_SORT = ["-changed_at", "-version", "id"];

/**
 * Parse the API's `changed_at` value. The backend sends second-precision
 * `"2026-10-30 05:14:55 +0000"` (not ISO), which `new Date()` does not parse
 * reliably, so we parse it explicitly. ISO input is accepted too.
 */
export function parseChangedAt(value: string | Date): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string") return Number(value) || 0;

  // ISO 8601 (with a T and timezone) parses natively.
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }

  // "2026-10-30 05:14:55 +0000" — second precision, no T.
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))? (?:([+-])(\d{2})(\d{2})|Z)$/.exec(
    value.trim(),
  );
  if (!m) {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  const [, y, mo, d, h, mi, s, frac, sign, oh, om] = m;
  let offsetMs = 0;
  if (sign) {
    const dir = sign === "+" ? 1 : -1;
    offsetMs = dir * (Number(oh) * 3600 + Number(om) * 60) * 1000;
  }
  const base = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  const fracMs = frac ? Number(`0.${frac}`) * 1000 : 0;
  return base - offsetMs + fracMs;
}

/** Map a backend record to the driver's IAnnotationChange. */
export function mapChange(rec: AnnotationChangeRecord): IAnnotationChange {
  return {
    id: rec.id,
    annotation_id: rec.annotation_id,
    account_id: rec.account_id,
    account_email: rec.account_email ?? null,
    op: rec.op,
    version: rec.version,
    changed_at: parseChangedAt(rec.changed_at),
  };
}

export function createChangesAdapter(entryId: string) {
  async function changes(query: IChangesQuery = {}): Promise<IChangesResult> {
    const { annotationIds, offset = 0, limit = 50 } = query;
    const filters: Record<string, unknown> = { entry_id: entryId };
    if (annotationIds?.length) filters["annotation_id__in"] = annotationIds;

    const page = Math.floor(offset / limit) + 1;
    const res = await annotationChangesBackendDataSource.list({
      filters,
      sort: DEFAULT_SORT,
      fields: HEADER_FIELDS,
      count: true,
      noCache: true,
      pagination: { page, itemsPerPage: limit },
    });

    return { items: res.data.map(mapChange), total: res.meta?.count ?? res.data.length };
  }

  async function version(id: string, version: number): Promise<AnnotationRecord> {
    return annotationsBackendDataSource.getVersion(id, version);
  }

  return { changes, version };
}

export type ChangesAdapter = ReturnType<typeof createChangesAdapter>;
