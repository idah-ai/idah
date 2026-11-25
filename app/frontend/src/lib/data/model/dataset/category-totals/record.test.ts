import { afterEach, describe, expect, it, vi } from "vitest";
import { RecordFactory } from "@/data/model/Record";
import { EntryCategoryCountRecord } from "@/data/model/dataset/entry-category-counts/record";
import { categoryTotalsBackendDataSource, DatasetCategoryTotalRecord, ProjectCategoryTotalRecord } from "./record";

afterEach(() => vi.unstubAllGlobals());

describe("category count records and transport", () => {
  it("decodes entry counts using their own JSON:API type", () => {
    const record = RecordFactory.create<EntryCategoryCountRecord>({
      type: EntryCategoryCountRecord.type,
      id: "count",
      attributes: {
        entry_id: "entry",
        dataset_id: "dataset",
        project_id: "project",
        category: "car",
        count: 2,
      },
    });
    expect(record).toBeInstanceOf(EntryCategoryCountRecord);
    expect(record.count).toBe(2);
  });

  it("encodes selected datasets and decodes project totals with contributing counts", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              type: ProjectCategoryTotalRecord.type,
              id: "total",
              attributes: {
                project_id: "project",
                category: "car",
                label: "Vehicle",
                annotation_count: 5,
                configured: true,
                datasets: [{ id: "a", name: "A", label: "Vehicle", configured: true, annotation_count: 5 }],
              },
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const response = await categoryTotalsBackendDataSource.project("project", ["a", "b"]);
    const url = new URL(fetch.mock.calls[0][0], "http://localhost");
    expect(url.searchParams.getAll("filter[dataset_id][]")).toEqual(["a", "b"]);
    expect(response.data[0]).toBeInstanceOf(ProjectCategoryTotalRecord);
    expect(response.data[0].datasets).toEqual([
      { id: "a", name: "A", label: "Vehicle", configured: true, annotation_count: 5 },
    ]);
  });

  it("batches dataset IDs and preserves an empty successful collection", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal("fetch", fetch);
    expect((await categoryTotalsBackendDataSource.datasets("project", ["a", "b"])).data).toEqual([]);
    const url = new URL(fetch.mock.calls[0][0], "http://localhost");
    expect(url.searchParams.get("filter[project_id]")).toBe("project");
    expect(url.searchParams.getAll("filter[dataset_id][]")).toEqual(["a", "b"]);
  });

  it("rejects a partial or incorrect resource collection", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [], links: { next: "/next" } })));
    await expect(categoryTotalsBackendDataSource.project("project", [])).rejects.toThrow();
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ type: DatasetCategoryTotalRecord.type }] })));
    await expect(categoryTotalsBackendDataSource.project("project", [])).rejects.toThrow();
  });

  it("retains HTTP status even when an access error returns a non-JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 })));
    await expect(categoryTotalsBackendDataSource.project("project", [])).rejects.toMatchObject({ status: 403 });
  });
});
