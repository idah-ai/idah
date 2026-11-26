import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectDashboardController } from "./project-dashboard-controller.svelte";
import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
import {
  categoryTotalsBackendDataSource,
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
      datasets: [{ id: "a", name: "A", label: "Car", configured: true, annotation_count: count }],
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

  it("reuses project totals while paging all datasets", async () => {
    const ids = Array.from({ length: 12 }, (_, index) => `dataset-${String(index).padStart(2, "0")}`);
    vi.mocked(datasetsBackendDataSource.list).mockImplementation(async (options) => {
      const page = options?.pagination?.page ?? 1;
      const pageIds = page === 1 ? ids.slice(0, 10) : ids.slice(10);
      return { data: pageIds.map(dataset), meta: { count: 12, more: false } };
    });
    vi.mocked(categoryTotalsBackendDataSource.project).mockResolvedValue({
      data: [
        new ProjectCategoryTotalRecord({
          type: ProjectCategoryTotalRecord.type,
          id: "total",
          attributes: {
            project_id: "project",
            category: "car",
            label: "Car",
            configured: true,
            annotation_count: 4,
            datasets: [
              { id: ids[0], name: ids[0], label: "Car", configured: true, annotation_count: 1 },
              { id: ids[10], name: ids[10], label: "Vehicle", configured: true, annotation_count: 3 },
            ],
          },
        }),
      ],
    });
    await controller.start();
    await vi.waitFor(() => expect(controller.datasetAnnotations[ids[0]]?.total).toBe(1));
    await controller.changeDatasetProgressPage({ page: 2, itemsPerPage: 10 });
    expect(controller.annotationsByCategory?.total).toBe(4);
    expect(controller.datasetAnnotations[ids[10]].total).toBe(3);
    expect(controller.datasetAnnotations[ids[11]].total).toBe(0);
    expect(categoryTotalsBackendDataSource.project).toHaveBeenCalledTimes(1);
    expect(categoryTotalsBackendDataSource.datasets).not.toHaveBeenCalled();
  });

  it("derives both sections for selected datasets across pages from one request", async () => {
    const ids = Array.from({ length: 12 }, (_, index) => `dataset-${String(index).padStart(2, "0")}`);
    vi.mocked(categoryTotalsBackendDataSource.project).mockResolvedValue({
      data: [
        new ProjectCategoryTotalRecord({
          type: ProjectCategoryTotalRecord.type,
          id: "total",
          attributes: {
            project_id: "project",
            category: "car",
            label: "car",
            configured: true,
            annotation_count: 5,
            datasets: [
              { id: ids[0], name: ids[0], label: "Car", configured: true, annotation_count: 2 },
              { id: ids[10], name: ids[10], label: "Vehicle", configured: true, annotation_count: 3 },
            ],
          },
        }),
      ],
    });
    await controller.select(ids);
    await vi.waitFor(() => expect(controller.annotationsByCategory?.total).toBe(5));
    expect(controller.datasetAnnotations[ids[0]].total).toBe(2);
    expect(controller.datasetAnnotations[ids[0]].rows[0].label).toBe("Car");
    expect(controller.datasetAnnotations[ids[1]].total).toBe(0);
    await controller.changeDatasetProgressPage({ page: 2, itemsPerPage: 10 });
    expect(categoryTotalsBackendDataSource.project).toHaveBeenCalledTimes(1);
    expect(controller.datasetAnnotations[ids[10]].total).toBe(3);
    expect(controller.datasetAnnotations[ids[10]].rows[0].label).toBe("Vehicle");
    expect(controller.datasetAnnotations[ids[11]].total).toBe(0);
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

  it("rejects totals from another dataset and retries both sections", async () => {
    vi.mocked(categoryTotalsBackendDataSource.project).mockResolvedValueOnce({ data: [projectTotal()] });
    await controller.select(["a"]);
    await vi.waitFor(() => expect(controller.datasetAnnotations.a?.total).toBe(3));
    vi.mocked(categoryTotalsBackendDataSource.project).mockResolvedValueOnce({
      data: [
        new ProjectCategoryTotalRecord({
          type: ProjectCategoryTotalRecord.type,
          id: "bad",
          attributes: {
            project_id: "project",
            category: "car",
            label: "Car",
            configured: true,
            annotation_count: 3,
            datasets: [{ id: "foreign", name: "Foreign", label: "Car", configured: true, annotation_count: 3 }],
          },
        }),
      ],
    });
    await controller.refreshCategoryCounts();
    expect(controller.annotationsByCategory?.status).toBe("error");
    expect(controller.datasetAnnotations.a.total).toBeNull();
    vi.mocked(categoryTotalsBackendDataSource.project).mockResolvedValueOnce({ data: [projectTotal()] });
    await controller.retryDatasetAnnotations();
    expect(controller.datasetAnnotations.a.total).toBe(3);
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

  it("refreshes all dataset pages when annotation counts change", async () => {
    const ids = Array.from({ length: 11 }, (_, index) => `dataset-${String(index).padStart(2, "0")}`);
    await controller.select(ids);
    await vi.waitFor(() => expect(controller.datasetAnnotations[ids[0]]?.status).toBe("ready"));
    await controller.changeDatasetProgressPage({ page: 2, itemsPerPage: 10 });
    expect(controller.datasetAnnotations[ids[0]]).toBeUndefined();
    await controller.refreshCategoryCounts();
    expect(categoryTotalsBackendDataSource.project).toHaveBeenCalledTimes(2);
    await controller.changeDatasetProgressPage({ page: 1, itemsPerPage: 10 });
    expect(controller.datasetAnnotations[ids[0]].status).toBe("ready");
    expect(categoryTotalsBackendDataSource.project).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid counts instead of displaying misleading totals", async () => {
    vi.mocked(categoryTotalsBackendDataSource.project).mockResolvedValue({ data: [projectTotal(-1)] });
    await controller.start();
    await vi.waitFor(() => expect(controller.annotationsByCategory?.status).toBe("error"));
    expect(controller.annotationsByCategory?.total).toBeNull();
  });

  it("rejects inconsistent per-dataset counts", async () => {
    vi.mocked(categoryTotalsBackendDataSource.project).mockResolvedValue({
      data: [
        new ProjectCategoryTotalRecord({
          type: ProjectCategoryTotalRecord.type,
          id: "bad",
          attributes: {
            project_id: "project",
            category: "car",
            label: "Car",
            configured: true,
            annotation_count: 3,
            datasets: [{ id: "a", name: "A", label: "Car", configured: true, annotation_count: 2 }],
          },
        }),
      ],
    });
    await controller.select(["a"]);
    await vi.waitFor(() => expect(controller.annotationsByCategory?.status).toBe("error"));
    expect(controller.datasetAnnotations.a.status).toBe("error");
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
