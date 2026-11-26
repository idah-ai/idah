import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectDashboardController } from "./project-dashboard-controller.svelte";
import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
import {
  categoryTotalsBackendDataSource,
  CategoryCountRecord,
  TotalCategoryCountRecord,
} from "@/data/model/dataset/category-totals/record";

const dataset = (id: string) =>
  new DatasetRecord({
    type: DatasetRecord.type,
    id,
    attributes: {
      name: id,
      entries_total_count: 0,
      entries_completed_count: 0,
      progress: 0,
      status: "pending",
    },
  });
const category = (id: string, count: number, datasetId?: string) =>
  new CategoryCountRecord({
    type: CategoryCountRecord.type,
    id: `${datasetId ?? "project"}:${id}`,
    attributes: {
      category: id,
      label: id,
      configured: true,
      annotation_count: count,
      ...(datasetId ? { dataset_id: datasetId } : {}),
    },
  });
const total = (id: string, count: number) =>
  new TotalCategoryCountRecord({
    type: TotalCategoryCountRecord.type,
    id,
    attributes: { dataset_id: id, annotation_count: count },
  });

let controller: ProjectDashboardController;
beforeEach(() => {
  vi.spyOn(entriesBackendDataSource, "summary").mockResolvedValue({
    total: 0,
    completed: 0,
    errored: 0,
    processing: 0,
    pending_annotation: 0,
    pending_review: 0,
    open: 0,
    review: 0,
    annotation: 0,
    reviewing: 0,
    annotating: 0,
  });
  vi.spyOn(entriesBackendDataSource, "list").mockResolvedValue({ data: [], meta: { count: 0, more: false } });
  vi.spyOn(datasetsBackendDataSource, "list").mockImplementation(async (options) => {
    const ids = options?.filters?.id;
    const rows = Array.isArray(ids) ? ids.map((id) => dataset(String(id))) : [dataset("a")];
    return { data: rows, meta: { count: rows.length, more: false } };
  });
  vi.spyOn(categoryTotalsBackendDataSource, "categoryCounts").mockResolvedValue({ data: [], more: false });
  vi.spyOn(categoryTotalsBackendDataSource, "totalCategoryCounts").mockResolvedValue({
    data: [total("a", 2)],
    more: false,
  });
  controller = new ProjectDashboardController("project");
});
afterEach(() => {
  controller.dispose();
  vi.restoreAllMocks();
});

describe("dashboard category counts", () => {
  it("requests totals again for each visible dataset page", async () => {
    vi.mocked(datasetsBackendDataSource.list).mockImplementation(async (options) => {
      const rows = options?.pagination?.page === 2 ? [dataset("b")] : [dataset("a")];
      return { data: rows, meta: { count: 2, more: false } };
    });
    vi.mocked(categoryTotalsBackendDataSource.totalCategoryCounts).mockImplementation(async (params) => ({
      data: [total(params.datasetIds![0], 1)],
      more: false,
    }));
    await controller.start();
    await vi.waitFor(() => expect(controller.datasetAnnotations.a?.total).toBe(1));
    await controller.changeDatasetProgressPage({ page: 2, itemsPerPage: 10 });
    await vi.waitFor(() => expect(controller.datasetAnnotations.b?.total).toBe(1));
    expect(categoryTotalsBackendDataSource.totalCategoryCounts).toHaveBeenCalledWith({
      projectId: "project",
      datasetIds: ["b"],
      groupBy: "dataset",
    });
  });

  it("loads card categories and visible table totals separately", async () => {
    vi.mocked(categoryTotalsBackendDataSource.categoryCounts).mockResolvedValue({
      data: [category("car", 2)],
      more: false,
    });
    await controller.start();
    await vi.waitFor(() => expect(controller.annotationsByCategory?.total).toBe(2));
    await vi.waitFor(() => expect(controller.datasetAnnotations.a?.total).toBe(2));
    expect(categoryTotalsBackendDataSource.categoryCounts).toHaveBeenCalledWith({
      projectId: "project",
      datasetIds: [],
    });
    expect(categoryTotalsBackendDataSource.totalCategoryCounts).toHaveBeenCalledWith({
      projectId: "project",
      datasetIds: ["a"],
      groupBy: "dataset",
    });
  });

  it("loads dataset hover independently and caches it", async () => {
    await controller.start();
    vi.mocked(categoryTotalsBackendDataSource.categoryCounts).mockResolvedValue({
      data: [category("car", 2, "a")],
      more: false,
    });
    await controller.loadDatasetCategories("a");
    await controller.loadDatasetCategories("a");
    expect(controller.datasetCategories.a?.rows[0].category).toBe("car");
    expect(categoryTotalsBackendDataSource.categoryCounts).toHaveBeenCalledTimes(2);
  });

  it("does not restore a stale dataset hover after refreshing counts", async () => {
    await controller.start();
    let finish!: (value: { data: CategoryCountRecord[]; more: boolean }) => void;
    vi.mocked(categoryTotalsBackendDataSource.categoryCounts).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const hover = controller.loadDatasetCategories("a");
    await controller.refreshCategoryCounts();
    finish({ data: [category("old", 2, "a")], more: false });
    await hover;
    expect(controller.datasetCategories.a).toBeUndefined();
    await controller.loadDatasetCategories("a");
    expect(categoryTotalsBackendDataSource.categoryCounts).toHaveBeenCalledTimes(4);
  });

  it("waits for category counts and dataset names, and reports lookup failure", async () => {
    await controller.start();
    vi.mocked(categoryTotalsBackendDataSource.categoryCounts).mockResolvedValue({
      data: [category("car", 2, "a")],
      more: false,
    });
    await controller.loadCategoryDatasets("car");
    expect(controller.categoryDatasets.car?.rows).toEqual([{ id: "a", name: "a", annotation_count: 2 }]);
    vi.mocked(datasetsBackendDataSource.list).mockRejectedValueOnce(new Error("names unavailable"));
    await controller.loadCategoryDatasets("person");
    expect(controller.categoryDatasets.person?.status).toBe("error");
    expect(controller.categoryDatasets.person?.error).toBe("names unavailable");
  });

  it("does not restore a stale category hover after refresh during name lookup", async () => {
    await controller.start();
    vi.mocked(categoryTotalsBackendDataSource.categoryCounts).mockResolvedValue({
      data: [category("car", 2, "a")],
      more: false,
    });
    let finish!: (value: Awaited<ReturnType<typeof datasetsBackendDataSource.list>>) => void;
    vi.mocked(datasetsBackendDataSource.list).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const hover = controller.loadCategoryDatasets("car");
    await vi.waitFor(() => expect(datasetsBackendDataSource.list).toHaveBeenCalledTimes(2));
    await controller.refreshCategoryCounts();
    finish({ data: [dataset("a")], meta: { count: 1, more: false } });
    await hover;
    expect(controller.categoryDatasets.car).toBeUndefined();
  });

  it("ignores a card response from an older scope", async () => {
    let finish!: (value: { data: CategoryCountRecord[]; more: boolean }) => void;
    const pending = new Promise<{ data: CategoryCountRecord[]; more: boolean }>((resolve) => {
      finish = resolve;
    });
    vi.mocked(categoryTotalsBackendDataSource.categoryCounts)
      .mockReturnValueOnce(pending)
      .mockResolvedValue({ data: [category("new", 1)], more: false });
    await controller.start();
    await controller.select(["a"]);
    await vi.waitFor(() => expect(controller.annotationsByCategory?.rows[0]?.category).toBe("new"));
    finish({ data: [category("old", 2)], more: false });
    await vi.waitFor(() => expect(controller.annotationsByCategory?.rows[0]?.category).toBe("new"));
  });
});
