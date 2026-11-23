import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectDashboardController } from "./project-dashboard-controller.svelte";
import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
import {
  categoryTotalsBackendDataSource,
  DatasetCategoryTotalRecord,
  ProjectCategoryTotalRecord,
} from "@/data/model/dataset/category-totals/record";
import type { CollectionResponse } from "@/data/model/types";

function dataset(id: string): DatasetRecord {
  return new DatasetRecord({
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
}

function projectTotal(count = 3): ProjectCategoryTotalRecord {
  return new ProjectCategoryTotalRecord({
    type: ProjectCategoryTotalRecord.type,
    id: "total",
    attributes: {
      project_id: "project",
      category: "car",
      label: "Car",
      configured: true,
      annotation_count: count,
      datasets: [{ id: "a", name: "A", annotation_count: count }],
    },
  });
}

function datasetTotal(id: string, count = 3): DatasetCategoryTotalRecord {
  return new DatasetCategoryTotalRecord({
    type: DatasetCategoryTotalRecord.type,
    id: `${id}:car`,
    attributes: {
      dataset_id: id,
      category: "car",
      label: "Car",
      configured: true,
      annotation_count: count,
    },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let controller: ProjectDashboardController;
beforeEach(() => {
  vi.spyOn(entriesBackendDataSource, "summary").mockResolvedValue({
    total: 0,
    completed: 0,
    review: 0,
    annotation: 0,
    reviewing: 0,
    annotating: 0,
  });
  vi.spyOn(entriesBackendDataSource, "list").mockResolvedValue({ data: [], meta: { count: 0, more: false } });
  vi.spyOn(datasetsBackendDataSource, "list").mockImplementation(async (options) => {
    const ids = options?.filters?.id;
    const rows = Array.isArray(ids) ? ids.map((id) => dataset(String(id))) : [];
    return { data: rows, meta: { count: rows.length, more: false } };
  });
  vi.spyOn(categoryTotalsBackendDataSource, "project").mockResolvedValue({ data: [] });
  vi.spyOn(categoryTotalsBackendDataSource, "datasets").mockResolvedValue({ data: [] });
  controller = new ProjectDashboardController("project");
});
afterEach(() => {
  controller.dispose();
  vi.restoreAllMocks();
});

describe("dashboard category integration", () => {
  it("loads the whole project independently of dataset table pagination", async () => {
    vi.mocked(categoryTotalsBackendDataSource.project).mockResolvedValue({ data: [projectTotal()] });
    await controller.start();
    await vi.waitFor(() => expect(controller.annotationsByCategory?.total).toBe(3));
    expect(categoryTotalsBackendDataSource.project).toHaveBeenCalledWith("project", []);
    expect(categoryTotalsBackendDataSource.datasets).not.toHaveBeenCalled();
  });

  it("batches visible selected datasets and does not reload the card when the table page changes", async () => {
    const ids = Array.from({ length: 12 }, (_, index) => `dataset-${String(index).padStart(2, "0")}`);
    await controller.select(ids);
    await vi.waitFor(() => expect(categoryTotalsBackendDataSource.datasets).toHaveBeenCalledTimes(1));
    expect(categoryTotalsBackendDataSource.datasets).toHaveBeenLastCalledWith("project", ids.slice(0, 10));
    await controller.changeDatasetProgressPage({ page: 2, itemsPerPage: 10 });
    expect(categoryTotalsBackendDataSource.datasets).toHaveBeenLastCalledWith("project", ids.slice(10));
    expect(categoryTotalsBackendDataSource.project).toHaveBeenCalledTimes(1);
    expect(controller.datasetAnnotations[ids[10]].total).toBe(0);
  });

  it("ignores a late project response after selecting a new scope", async () => {
    const old = deferred<CollectionResponse<ProjectCategoryTotalRecord>>();
    vi.mocked(categoryTotalsBackendDataSource.project).mockReturnValueOnce(old.promise);
    await controller.start();
    await controller.select(["a"]);
    await vi.waitFor(() => expect(controller.annotationsByCategory?.total).toBe(0));
    old.resolve({ data: [projectTotal(99)] });
    await Promise.resolve();
    expect(controller.annotationsByCategory?.total).toBe(0);
    expect(categoryTotalsBackendDataSource.project).toHaveBeenLastCalledWith("project", ["a"]);
  });

  it("changes the category scope when stepping into a focused dataset", async () => {
    await controller.select(["a", "b"]);
    controller.step(1);
    expect(categoryTotalsBackendDataSource.project).toHaveBeenLastCalledWith("project", ["a"]);
    expect(controller.categoryScopeLabel).toBe("a");
    controller.showAllDatasets();
    expect(categoryTotalsBackendDataSource.project).toHaveBeenLastCalledWith("project", ["a", "b"]);
  });

  it("keeps failed totals unknown and retries both sections without changing selection", async () => {
    vi.mocked(categoryTotalsBackendDataSource.project).mockRejectedValueOnce(new Error("Offline"));
    await controller.select(["a"]);
    await vi.waitFor(() => expect(controller.annotationsByCategory?.status).toBe("error"));
    expect(controller.annotationsByCategory?.total).toBeNull();
    vi.mocked(categoryTotalsBackendDataSource.project).mockResolvedValue({ data: [projectTotal()] });
    await controller.refreshCategoryCounts();
    expect(controller.annotationsByCategory?.total).toBe(3);
    expect(controller.selectedDatasetIds).toEqual(["a"]);
  });

  it("deduplicates in-flight batch requests and rejects totals from another dataset", async () => {
    const batch = deferred<CollectionResponse<DatasetCategoryTotalRecord>>();
    vi.mocked(categoryTotalsBackendDataSource.datasets).mockReturnValueOnce(batch.promise);
    await controller.select(["a"]);
    await controller.retryDatasetAnnotations();
    expect(categoryTotalsBackendDataSource.datasets).toHaveBeenCalledTimes(1);
    batch.resolve({ data: [datasetTotal("foreign")] });
    await vi.waitFor(() => expect(controller.datasetAnnotations.a.status).toBe("error"));
    expect(controller.datasetAnnotations.a.total).toBeNull();
  });

  it("clears totals when access is revoked", async () => {
    vi.mocked(categoryTotalsBackendDataSource.project).mockRejectedValue({ status: 403 });
    await controller.start();
    await vi.waitFor(() => expect(controller.denied).toBe(true));
    expect(controller.annotationsByCategory).toBeNull();
    expect(controller.datasetAnnotations).toEqual({});
    await controller.refreshCategoryCounts();
    expect(categoryTotalsBackendDataSource.project).toHaveBeenCalledTimes(1);
  });

  it("refreshes cached dataset pages when annotation counts change", async () => {
    const ids = Array.from({ length: 11 }, (_, index) => `dataset-${String(index).padStart(2, "0")}`);
    await controller.select(ids);
    await vi.waitFor(() => expect(controller.datasetAnnotations[ids[0]]?.status).toBe("ready"));
    await controller.changeDatasetProgressPage({ page: 2, itemsPerPage: 10 });
    expect(controller.datasetAnnotations[ids[0]].status).toBe("ready");
    await controller.refreshCategoryCounts();
    expect(controller.datasetAnnotations[ids[0]]).toBeUndefined();
    await controller.changeDatasetProgressPage({ page: 1, itemsPerPage: 10 });
    expect(categoryTotalsBackendDataSource.datasets).toHaveBeenCalledTimes(4);
  });

  it("rejects invalid counts instead of displaying misleading totals", async () => {
    vi.mocked(categoryTotalsBackendDataSource.project).mockResolvedValue({ data: [projectTotal(-1)] });
    await controller.start();
    await vi.waitFor(() => expect(controller.annotationsByCategory?.status).toBe("error"));
    expect(controller.annotationsByCategory?.total).toBeNull();
  });

  it("ignores responses after disposal", async () => {
    const pending = deferred<CollectionResponse<ProjectCategoryTotalRecord>>();
    vi.mocked(categoryTotalsBackendDataSource.project).mockReturnValueOnce(pending.promise);
    await controller.start();
    controller.dispose();
    pending.resolve({ data: [projectTotal()] });
    await Promise.resolve();
    expect(controller.annotationsByCategory).toBeNull();
  });
});
