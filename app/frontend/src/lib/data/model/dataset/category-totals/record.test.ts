import { afterEach, describe, expect, it, vi } from "vitest";
import { categoryTotalsBackendDataSource, CategoryCountRecord, TotalCategoryCountRecord } from "./record";

afterEach(() => vi.unstubAllGlobals());

describe("annotation count transport", () => {
  it("sends category scope and decodes a flat category row", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              type: CategoryCountRecord.type,
              id: "car",
              attributes: {
                category: "car",
                label: "Car",
                configured: true,
                annotation_count: 2,
              },
            },
          ],
          meta: { more: false },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const response = await categoryTotalsBackendDataSource.categoryCounts({ projectId: "project", datasetIds: ["a"] });
    const url = new URL(fetch.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/api/v1/dataset/entries/category_counts");
    expect(url.searchParams.get("filter[project_id]")).toBe("project");
    expect(url.searchParams.getAll("filter[dataset_id][]")).toEqual(["a"]);
    expect(response.data[0]).toBeInstanceOf(CategoryCountRecord);
    expect(response.more).toBe(false);
  });

  it("sends paging and group level for total rows", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { type: TotalCategoryCountRecord.type, id: "a", attributes: { dataset_id: "a", annotation_count: 0 } },
          ],
          meta: { more: true },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const response = await categoryTotalsBackendDataSource.totalCategoryCounts({
      projectId: "project",
      groupBy: "dataset",
      page: 2,
      pageSize: 10,
    });
    const url = new URL(fetch.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/api/v1/dataset/entries/total_category_counts");
    expect(url.searchParams.get("group_by")).toBe("dataset");
    expect(url.searchParams.get("page[number]")).toBe("2");
    expect(response.data[0]).toBeInstanceOf(TotalCategoryCountRecord);
    expect(response.more).toBe(true);
  });

  it("rejects malformed response and preserves access status", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: {} })));
    await expect(categoryTotalsBackendDataSource.categoryCounts({ projectId: "project" })).rejects.toThrow();
    fetch.mockResolvedValueOnce(new Response("Forbidden", { status: 403 }));
    await expect(categoryTotalsBackendDataSource.categoryCounts({ projectId: "project" })).rejects.toMatchObject({
      status: 403,
    });
  });
});
