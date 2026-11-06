import { describe, it, expect, vi, afterEach } from "vitest";
import { RecordFactory } from "@/data/model/Record";
import { annotationsBackendDataSource, AnnotationRecord } from "@/data/model/dataset/annotations/record";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AnnotationRecord", () => {
  it("exposes the server-set version field", () => {
    const record = RecordFactory.create<AnnotationRecord>({
      type: "dataset:annotations",
      id: "ann-1",
      attributes: {
        shape_type: "bounding-box",
        shape_args: { x: 1 },
        category: "cat",
        version: 4,
      },
    });

    expect(record.version).toBe(4);
  });

  it("has no version on a locally built record", () => {
    const record = new AnnotationRecord();
    expect(record.version).toBeUndefined();
  });
});

describe("annotationsBackendDataSource.getVersion", () => {
  it("calls GET /annotations/:id/versions/:version and returns an AnnotationRecord", async () => {
    const body = {
      data: {
        type: "dataset:annotations",
        id: "ann-1",
        attributes: {
          shape_type: "bounding-box",
          shape_args: { x: 1 },
          category: "cat",
          version: 2,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve(body),
    });
    vi.stubGlobal("fetch", fetchMock);

    const record = await annotationsBackendDataSource.getVersion("ann-1", 2);

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/dataset/annotations/ann-1/versions/2", {
      method: "GET",
    });
    expect(record).toBeInstanceOf(AnnotationRecord);
    expect(record.id).toBe("ann-1");
    expect(record.version).toBe(2);
  });

  it("rejects on a JSON:API error document", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 404,
      json: () =>
        Promise.resolve({
          errors: [{ status: 404, title: "RecordNotFound", detail: "not found" }],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(annotationsBackendDataSource.getVersion("ann-1", 99)).rejects.toBeDefined();
  });
});
