import { describe, it, expect } from "vitest";
import { RecordFactory } from "@/data/model/Record";
import { AnnotationChangeRecord } from "@/data/model/dataset/annotation_changes/record";

describe("AnnotationChangeRecord", () => {
  it("deserializes a JSON:API dataset:annotation_changes document", () => {
    const record = RecordFactory.create<AnnotationChangeRecord>({
      type: "dataset:annotation_changes",
      id: "change-1",
      attributes: {
        annotation_id: "ann-1",
        entry_id: "entry-1",
        project_id: "project-1",
        account_id: 4,
        op: "updated",
        version: 3,
        changes: [
          ["~", "shape_args.frames[frame=57].points", [1, 2], [3, 4]],
          ["+", "properties.occluded", null, true],
        ],
        changed_at: "2026-01-01T00:00:00.000Z",
      },
    });

    expect(record.id).toBe("change-1");
    expect(record.annotation_id).toBe("ann-1");
    expect(record.entry_id).toBe("entry-1");
    expect(record.project_id).toBe("project-1");
    expect(record.account_id).toBe(4);
    expect(record.op).toBe("updated");
    expect(record.version).toBe(3);
    expect(record.changes).toEqual([
      ["~", "shape_args.frames[frame=57].points", [1, 2], [3, 4]],
      ["+", "properties.occluded", null, true],
    ]);
    expect(record.changed_at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("keeps a null account_id for system writes", () => {
    const record = RecordFactory.create<AnnotationChangeRecord>({
      type: "dataset:annotation_changes",
      id: "change-2",
      attributes: {
        annotation_id: "ann-1",
        entry_id: "entry-1",
        project_id: "project-1",
        account_id: null,
        op: "created",
        version: 1,
        changes: [["+", "category", null, "cat"]],
        changed_at: "2026-01-01T00:00:00.000Z",
      },
    });

    expect(record.account_id).toBeNull();
  });
});
