// ---------------------------------------------------------------------------
// changes.test.ts — the shared annotation change history adapter (thin proxy)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { createChangesAdapter, parseChangedAt } from "./changes";
import {
  annotationChangesBackendDataSource,
  AnnotationChangeRecord,
} from "@/data/model/dataset/annotation_changes/record";
import { RecordFactory } from "@/data/model/Record";

function makeRecord(id = "change-1", overrides: Partial<Record<string, unknown>> = {}): AnnotationChangeRecord {
  return RecordFactory.create<AnnotationChangeRecord>({
    type: "dataset:annotation_changes",
    id,
    attributes: {
      annotation_id: "ann-1",
      entry_id: "entry-1",
      project_id: "project-1",
      account_id: 4,
      account_email: "user@example.com",
      op: "updated",
      version: 3,
      changes: [["~", "shape_args.x", 1, 2]],
      changed_at: "2026-10-30 05:14:55 +0000",
      ...overrides,
    },
  });
}

describe("parseChangedAt", () => {
  it("parses the backend's second-precision format", () => {
    // "2026-10-30 05:14:55 +0000" is UTC.
    expect(parseChangedAt("2026-10-30 05:14:55 +0000")).toBe(Date.UTC(2026, 9, 30, 5, 14, 55));
  });

  it("parses an ISO timestamp", () => {
    expect(parseChangedAt("2026-10-30T05:14:55.000Z")).toBe(Date.UTC(2026, 9, 30, 5, 14, 55));
  });
});

describe("createChangesAdapter", () => {
  const entryId = "entry-1";

  beforeAll(() => {
    vi.spyOn(annotationChangesBackendDataSource, "list").mockResolvedValue({ data: [] } as never);
  });

  beforeEach(() => {
    vi.mocked(annotationChangesBackendDataSource.list).mockClear();
  });

  // `changes()` makes a single list call that returns both the page and the
  // true total count in the response meta.
  function mockList(pageData: unknown[], total: number) {
    vi.mocked(annotationChangesBackendDataSource.list).mockResolvedValue({
      data: pageData as never,
      meta: { count: total },
    });
  }

  it("proxies the index endpoint with entry_id, sparse fields, sort and count", async () => {
    const adapter = createChangesAdapter(entryId);
    mockList([makeRecord()], 1);

    const result = await adapter.changes();

    expect(annotationChangesBackendDataSource.list).toHaveBeenCalledTimes(1);
    expect(annotationChangesBackendDataSource.list).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { entry_id: entryId },
        sort: ["-changed_at"],
        fields: {
          "dataset:annotation_changes": ["annotation_id", "account_id", "account_email", "op", "version", "changed_at"],
        },
        count: true,
        noCache: true,
        pagination: { page: 1, itemsPerPage: 50 },
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ id: "change-1", op: "updated", version: 3 });
  });

  it("maps a null actor and both timestamp formats", async () => {
    const adapter = createChangesAdapter(entryId);
    mockList(
      [
        makeRecord("c-1", { account_id: null, account_email: null, changed_at: "2026-10-30 05:14:55 +0000" }),
        makeRecord("c-2", { changed_at: "2026-10-30T05:14:55.000Z" }),
      ],
      2,
    );

    const { items } = await adapter.changes({ limit: 100 });
    expect(items[0]).toMatchObject({ id: "c-1", account_id: null, account_email: null });
    expect(items[0].changed_at).toBe(Date.UTC(2026, 9, 30, 5, 14, 55));
    expect(items[1].changed_at).toBe(Date.UTC(2026, 9, 30, 5, 14, 55));
  });

  it("filters by annotation_id__in and pages by page/size", async () => {
    const adapter = createChangesAdapter(entryId);
    mockList([makeRecord()], 1);

    await adapter.changes({ filters: { annotation_id__in: ["ann-1", "ann-2"] }, page: 2, size: 50 });

    expect(annotationChangesBackendDataSource.list).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { entry_id: entryId, annotation_id__in: ["ann-1", "ann-2"] },
        pagination: { page: 2, itemsPerPage: 50 },
      }),
    );
  });

  it("includes the diff payload when changes is in fields", async () => {
    const adapter = createChangesAdapter(entryId);
    mockList([makeRecord()], 1);

    const { items } = await adapter.changes({
      fields: ["annotation_id", "account_id", "account_email", "op", "version", "changed_at", "changes"],
    });
    expect(items[0].changes).toEqual([["~", "shape_args.x", 1, 2]]);

    expect(annotationChangesBackendDataSource.list).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: {
          "dataset:annotation_changes": [
            "annotation_id",
            "account_id",
            "account_email",
            "op",
            "version",
            "changed_at",
            "changes",
          ],
        },
      }),
    );
  });

  it("anchors the list with changed_at__lte", async () => {
    const adapter = createChangesAdapter(entryId);
    mockList([makeRecord()], 1);

    await adapter.changes({ filters: { changed_at__lte: Date.UTC(2026, 9, 30, 5, 14, 55) } });

    expect(annotationChangesBackendDataSource.list).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { entry_id: entryId, changed_at__lte: "2026-10-30T05:14:55.000Z" },
      }),
    );
  });

  it("filters by change ids, ops and changed_at__gte", async () => {
    const adapter = createChangesAdapter(entryId);
    mockList([makeRecord()], 1);

    await adapter.changes({
      filters: {
        id__in: ["c-1"],
        op__in: ["updated", "deleted"],
        changed_at__gte: Date.UTC(2026, 9, 30, 5, 14, 55),
      },
    });

    expect(annotationChangesBackendDataSource.list).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          entry_id: entryId,
          id__in: ["c-1"],
          op__in: ["updated", "deleted"],
          changed_at__gte: "2026-10-30T05:14:55.000Z",
        },
      }),
    );
  });
});
