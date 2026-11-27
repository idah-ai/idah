import { resourcePath } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { parseCollectionReturn, parseSingleElementError } from "@/data/model/json_api";

@type("dataset:category_counts")
export class CategoryCountRecord extends Record {
  @field() public readonly project_id?: string;
  @field() public readonly dataset_id?: string;
  @field() public readonly entry_id?: string;
  @field() public readonly category!: string;
  @field() public readonly label!: string;
  @field() public readonly configured!: boolean;
  @field() public readonly annotation_count!: number;
}

@type("dataset:total_category_counts")
export class TotalCategoryCountRecord extends Record {
  @field() public readonly project_id?: string;
  @field() public readonly dataset_id?: string;
  @field() public readonly entry_id?: string;
  @field() public readonly annotation_count!: number;
}

RecordFactory.registerTypes(CategoryCountRecord, TotalCategoryCountRecord);

export interface CountParams {
  projectId?: string;
  datasetIds?: string[];
  entryIds?: string[];
  category?: string;
  groupBy?: "category" | "project" | "dataset" | "entry";
  page?: number;
  pageSize?: number;
}

export interface CountResponse<T extends Record> {
  data: T[];
  more: boolean;
}

async function fetchCounts<T extends Record>(
  path: string,
  params: CountParams,
  expectedType: string,
): Promise<CountResponse<T>> {
  const url = resourcePath(`/api/v1/dataset/entries/${path}`, null, {
    filter: {
      ...(params.projectId ? { project_id: params.projectId } : {}),
      ...(params.datasetIds?.length ? { dataset_id: params.datasetIds } : {}),
      ...(params.entryIds?.length ? { entry_id: params.entryIds } : {}),
      ...(params.category ? { category: params.category } : {}),
    },
    ...(params.groupBy ? { group_by: params.groupBy } : {}),
    ...(params.page || params.pageSize ? { page: { number: params.page ?? 1, size: params.pageSize ?? 10 } } : {}),
  });
  const response = await fetch(url, { headers: { Accept: "application/vnd.api+json" }, cache: "no-store" });
  const body = await response.json().catch((reason) => {
    if (!response.ok) throw parseSingleElementError({ status: response.status, errors: [] });
    throw reason;
  });
  if (!response.ok || body?.errors)
    throw parseSingleElementError({ status: response.status, errors: body?.errors ?? [] });
  if (
    !Array.isArray(body?.data) ||
    typeof body?.meta?.more !== "boolean" ||
    body.data.some((row: { type?: string }) => row?.type !== expectedType)
  )
    throw new Error("Category counts could not be validated. Please retry.");
  return { data: parseCollectionReturn<T>(body).data, more: body.meta.more };
}

export const categoryTotalsBackendDataSource = {
  categoryCounts(params: CountParams): Promise<CountResponse<CategoryCountRecord>> {
    return fetchCounts("category_counts", params, CategoryCountRecord.type);
  },
  totalCategoryCounts(params: CountParams): Promise<CountResponse<TotalCategoryCountRecord>> {
    return fetchCounts("total_category_counts", params, TotalCategoryCountRecord.type);
  },
};
