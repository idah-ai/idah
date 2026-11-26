import { describe, it, expect } from "vitest";
import { IncludeList } from "@/data/model/includes";
import { NoteFeedRecord } from "@/data/model/dataset/notes/feeds/record";

function buildFeed(overrides: Record<string, unknown> = {}, annotationId: string | null = null): NoteFeedRecord {
  const data = {
    type: "dataset:note_feeds",
    id: "feed-1",
    attributes: {
      entry_id: "entry-1",
      annotation_id: annotationId,
      anchor_type: "entry",
      position: {},
      status: "pending",
      content_md: "hello",
      created_by_email: "user@example.com",
      created_at: "2020-01-01T00:00:00Z",
      updated_at: "2020-01-01T00:00:00Z",
      edited_at: null,
      ...overrides,
    },
    relationships: annotationId
      ? {
          annotation: {
            data: { type: "dataset:annotations", id: annotationId },
          },
        }
      : undefined,
  };
  return new NoteFeedRecord(data);
}

describe("NoteFeedRecord.isAnchorDeleted", () => {
  it("returns false for an entry anchor", () => {
    const feed = buildFeed({ anchor_type: "entry", annotation_id: null });
    expect(feed.isAnchorDeleted).toBe(false);
  });

  it("returns false for an annotation anchor with a live annotation", () => {
    const feed = buildFeed({ anchor_type: "annotation" }, "ann-1");
    const included = new IncludeList([
      {
        type: "dataset:annotations",
        id: "ann-1",
        attributes: { deleted_at: null },
      },
    ]);
    const withRel = new NoteFeedRecord(feed._jsonapiData, included);
    expect(withRel.isAnchorDeleted).toBe(false);
  });

  it("returns true for an annotation anchor with a deleted annotation", () => {
    const feed = buildFeed({ anchor_type: "annotation" }, "ann-1");
    const included = new IncludeList([
      {
        type: "dataset:annotations",
        id: "ann-1",
        attributes: { deleted_at: "2020-02-01T00:00:00Z" },
      },
    ]);
    const withRel = new NoteFeedRecord(feed._jsonapiData, included);
    expect(withRel.isAnchorDeleted).toBe(true);
  });

  it("returns false for an annotation anchor when the annotation is not loaded", () => {
    const feed = buildFeed({ anchor_type: "annotation" }, "ann-1");
    // No include list → annotation relationship is not resolved.
    expect(feed.isAnchorDeleted).toBe(false);
  });

  it("uses the annotation's deleted_at field directly", () => {
    const feed = buildFeed({ anchor_type: "annotation" }, "ann-1");
    const included = new IncludeList([
      {
        type: "dataset:annotations",
        id: "ann-1",
        attributes: { deleted_at: "2020-02-01T00:00:00Z" },
      },
    ]);
    const withRel = new NoteFeedRecord(feed._jsonapiData, included);
    expect(withRel.annotation?.deleted_at).toBeTruthy();
    expect(withRel.isAnchorDeleted).toBe(true);
  });
});
