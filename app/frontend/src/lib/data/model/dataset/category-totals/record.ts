import { resourcePath } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { parseCollectionReturn, parseSingleElementError } from "@/data/model/json_api";
import type { CollectionResponse } from "@/data/model/types";

@type("dataset:category_totals")
export class DatasetCategoryTotalRecord extends Record {
  @field() public readonly dataset_id!: string;
  @field() public readonly category!: string;
  @field() public readonly label!: string;
  @field() public readonly configured!: boolean;
  @field() public readonly annotation_count!: number;
}

@type("dataset:project_category_totals")
export class ProjectCategoryTotalRecord extends Record {
  @field() public readonly project_id!: string;
  @field() public readonly category!: string;
  @field() public readonly label!: string;
  @field() public readonly configured!: boolean;
  @field() public readonly annotation_count!: number;
  @field() public readonly datasets!: {
    id: string;
    name: string;
    label: string;
    configured: boolean;
    annotation_count: number;
  }[];
}

RecordFactory.registerTypes(DatasetCategoryTotalRecord, ProjectCategoryTotalRecord);

async function fetchTotals<T extends Record>(url: string, expectedType: string): Promise<CollectionResponse<T>> {
  const response = await fetch(url, { headers: { Accept: "application/vnd.api+json" }, cache: "no-store" });
  const body = await response.json().catch((reason) => {
    if (!response.ok) throw parseSingleElementError({ status: response.status, errors: [] });
    throw reason;
  });
  if (!response.ok || body?.errors)
    throw parseSingleElementError({ status: response.status, errors: body?.errors ?? [] });
  if (
    !Array.isArray(body?.data) ||
    body.links?.next ||
    body.meta?.more === true ||
    body.data.some((row: { type?: string }) => row?.type !== expectedType)
  )
    throw new Error("Category totals could not be validated. Please retry.");
  return parseCollectionReturn<T>(body);
}

export const categoryTotalsBackendDataSource = {
  project(projectId: string, datasetIds: string[]): Promise<CollectionResponse<ProjectCategoryTotalRecord>> {
    return fetchTotals(
      resourcePath(`/api/v1/dataset/projects/${encodeURIComponent(projectId)}/category_counts`, null, {
        ...(datasetIds.length ? { filter: { dataset_id: datasetIds } } : {}),
      }),
      ProjectCategoryTotalRecord.type,
    );
  },
  datasets(projectId: string, datasetIds: string[]): Promise<CollectionResponse<DatasetCategoryTotalRecord>> {
    return fetchTotals(
      resourcePath("/api/v1/dataset/datasets/category_counts", null, {
        filter: { project_id: projectId, dataset_id: datasetIds },
      }),
      DatasetCategoryTotalRecord.type,
    );
  },
};
