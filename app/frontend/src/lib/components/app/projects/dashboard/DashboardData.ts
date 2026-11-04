import type { BackendDataSource } from "@/data/BackendDataSource";
import type { ListOptions } from "@/data/DataSource";
import { datasetsBackendDataSource, DatasetRecord } from "@/data/model/dataset/dataset-record";
import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
import { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";
import type { Record } from "@/data/model/Record";
import type { CollectionResponse, JsonApiErrorResponse } from "@/data/model/types";

export type Counts = {
  total: number;
  completed: number;
  reviewing: number;
  pendingReview: number;
  annotating: number;
  pendingAnnotation: number;
  residual: number;
};
export type DatasetTableContexts = {
  countsByDataset: { [id: string]: Counts | null };
  choose?: (record: DatasetRecord) => void;
};

export function isAccessError(error: unknown): error is JsonApiErrorResponse {
  return !!error && typeof error === "object" && "status" in error && [401, 403, 404].includes(Number(error.status));
}

export function validateCounts(values: unknown[]): Counts {
  if (values.length !== 6 || values.some((v) => typeof v !== "number" || !Number.isSafeInteger(v) || v < 0))
    throw new Error("Dashboard count unavailable");
  const [total, completed, reviewing, pendingReview, annotating, pendingAnnotation] = values as number[];
  const residual = total - completed - reviewing - pendingReview - annotating - pendingAnnotation;
  if (residual < 0) throw new Error("Dashboard counts changed while loading. Please refresh.");
  return { total, completed, reviewing, pendingReview, annotating, pendingAnnotation, residual };
}
export function normalizeTableQuery(options: ListOptions, ids: string[]): ListOptions {
  const filters = options.filters ?? {};
  if (Object.keys(filters).some((k) => k !== "name__match")) throw new Error("Unsupported Dashboard table filter");
  const name = filters.name__match;
  if (name !== undefined && typeof name !== "string") throw new Error("Invalid Dataset name filter");
  const pagination = options.pagination ?? { page: 1, itemsPerPage: 10 };
  if (!Number.isInteger(pagination.page) || pagination.page < 1 || ![10, 25, 50, 100].includes(pagination.itemsPerPage))
    throw new Error("Invalid Dashboard page");
  const direction = options.sort?.filter((k) => k === "name" || k === "-name").at(-1) ?? "name";
  return {
    filters: { ...(ids.length ? { id: [...ids] } : {}), ...(name ? { name__match: name } : {}) },
    sort: [direction, "id"],
    pagination: { ...pagination },
    count: true,
  };
}

// Keep Project scope and count aggregation local; transport and parsing use the existing datasources.
export function createProjectDashboardDataSources(projectId: string, denied: (error: JsonApiErrorResponse) => void) {
  let retired = false;
  let activeCounts = 0;
  const waitingCounts: (() => void)[] = [];
  async function countRequest<T>(work: () => Promise<T>): Promise<T> {
    if (activeCounts >= 4) await new Promise<void>((resolve) => waitingCounts.push(resolve));
    else activeCounts++;
    try {
      return await work();
    } finally {
      const next = waitingCounts.shift();
      if (next) next();
      else activeCounts--;
    }
  }

  function source<T extends Record>(existing: BackendDataSource<T>, fields: string[], sort: string[]) {
    return {
      ...existing,
      async list(options: ListOptions = {}): Promise<CollectionResponse<T>> {
        if (retired) throw new Error("Dashboard request retired");
        if (options.filters?.project_id && options.filters.project_id !== projectId)
          throw new Error("Conflicting Project scope");
        if (options.all) throw new Error("Unbounded Dashboard reads are unsupported");
        try {
          const result = await existing.list({
            ...options,
            filters: { ...options.filters, project_id: projectId },
            fields: options.fields ?? { [existing.recordClass.type]: fields },
            sort: options.sort ?? sort,
            pagination: options.pagination ?? { page: 1, itemsPerPage: 10 },
            noCache: true,
          });
          if (retired) throw new Error("Dashboard request retired");
          if (options.count && (!Number.isSafeInteger(result.meta?.count) || Number(result.meta?.count) < 0))
            throw new Error("Dashboard count unavailable");
          return result;
        } catch (error) {
          if (!retired && isAccessError(error)) denied(error);
          throw error;
        }
      },
    };
  }
  const datasets = source(
    datasetsBackendDataSource,
    ["id", "name", "modality", "delivery_date", "entries_total_count", "entries_completed_count", "progress", "status"],
    ["name", "id"],
  );
  const entries = source(entriesBackendDataSource, ["id"], ["id"]);

  async function counts(ids: string[]): Promise<Counts> {
    const scope = ids.length ? { dataset_id: [...ids] } : {};
    const groups = [
      {},
      { status__in: ["completed"] },
      { wf_step__in: ["review"], status__in: ["pending", "in_progress"], assigned: true },
      { wf_step__in: ["review"], status__in: ["pending", "in_progress"], assigned: false },
      { wf_step__in: ["annotate"], status__in: ["pending", "in_progress"], assigned: true },
      { wf_step__in: ["annotate"], status__in: ["pending", "in_progress"], assigned: false },
    ];
    const values = await Promise.all(
      groups.map((filters) =>
        countRequest(async () => {
          const result = await entries.list({
            filters: { ...scope, ...filters },
            pagination: { page: 1, itemsPerPage: 1 },
            count: true,
          });
          if (result.meta?.more)
            throw new Error(
              "The existing Entries API caps counts at 1,000. Exact workflow totals are unavailable for this scope.",
            );
          return result.meta?.count;
        }),
      ),
    );
    return validateCounts(values);
  }

  async function attention(ids: string[], today: Date = new Date()) {
    const result = await datasets.list({
      filters: ids.length ? { id: [...ids] } : {},
      pagination: { page: 1, itemsPerPage: 100 },
      count: true,
    });
    if (result.meta?.more || result.meta?.count !== result.data.length) return null;
    return result.data.filter((dataset) => dataset.isOverdueOn(today)).length;
  }
  return {
    datasets,
    attention,
    openEntries(ids: string[], combined = true) {
      const selected = [...ids];
      let latest: Promise<CollectionResponse<EntryRecord>>;
      let latestPagination: { page: number; itemsPerPage: number };
      const contexts = new WeakMap<CollectionResponse<EntryRecord>, { datasetNames: { [id: string]: string } }>();
      return {
        ...entries,
        contexts: (response: CollectionResponse<EntryRecord>) => contexts.get(response) ?? {},
        async list(options: ListOptions = {}) {
          latest = (async () => {
            const pagination = options.pagination ?? { page: 1, itemsPerPage: 10 };
            if (
              !Number.isInteger(pagination.page) ||
              pagination.page < 1 ||
              ![10, 25, 50, 100].includes(pagination.itemsPerPage)
            )
              throw new Error("Invalid Open entries page");
            latestPagination = { ...pagination };
            const response = await entries.list({
              filters: {
                ...(selected.length ? { dataset_id: selected } : {}),
                status__in: ["pending", "in_progress"],
                wf_step__in: ["annotate", "review"],
              },
              included: ["assigned_to"],
              fields: {
                [EntryRecord.type]: [
                  "id",
                  "name",
                  "resource",
                  "dataset_id",
                  "wf_step",
                  "status",
                  "assigned_to_id",
                  "assigned_to_email",
                  "assigned_to",
                  "created_at",
                ],
                [ProjectMemberRecord.type]: ["id", "project_id", "account_id", "name", "email"],
              },
              pagination: { ...pagination },
              sort: ["created_at", "id"],
              count: true,
            });
            if (combined && response.data.length) {
              const names = await datasets.list({
                filters: { id: [...new Set(response.data.map((record) => record.dataset_id))] },
                pagination: { page: 1, itemsPerPage: response.data.length },
                count: false,
              });
              contexts.set(response, {
                datasetNames: Object.fromEntries(names.data.map((record) => [record.id, record.name])),
              });
            }
            return response;
          })();
          while (true) {
            const observed = latest;
            try {
              const response = await observed;
              if (observed !== latest) continue;
              // The shared table commits these captured preferences after list/enrichment.
              if (options.pagination) Object.assign(options.pagination, latestPagination);
              if (options.sort) options.sort.splice(0, options.sort.length, "created_at", "id");
              return response;
            } catch (error) {
              if (observed === latest) throw error;
            }
          }
        },
      };
    },
    counts,
    table: (ids: string[]) => datasetTableSource(datasets, ids),
    retire: () => {
      retired = true;
    },
  };
}
export type ProjectDashboardDataSources = ReturnType<typeof createProjectDashboardDataSources>;

function datasetTableSource(datasets: BackendDataSource<DatasetRecord>, ids: string[]) {
  const selected = [...ids];
  let previousName: string | undefined;
  let latest: Promise<CollectionResponse<DatasetRecord>>;
  let latestQuery: ListOptions;
  const optionsByResponse = new WeakMap<CollectionResponse<DatasetRecord>, ListOptions[]>();

  async function currentResponse() {
    while (true) {
      const observed = latest;
      try {
        const response = await observed;
        if (observed === latest) return response;
      } catch (error) {
        if (observed === latest) throw error;
      }
    }
  }
  function syncOptions(options: ListOptions) {
    // DatasourceTable writes these captured preferences after enrichment finishes.
    if (options.pagination) Object.assign(options.pagination, latestQuery.pagination);
    if (options.sort) options.sort.splice(0, options.sort.length, ...(latestQuery.sort ?? []));
  }
  return {
    ...datasets,
    position(id: string, response: CollectionResponse<DatasetRecord>) {
      if (latestQuery.filters?.name__match || latestQuery.sort?.[0] !== "name") return null;
      const index = response.data.findIndex((record) => record.id === id);
      return index < 0
        ? null
        : ((latestQuery.pagination?.page ?? 1) - 1) * (latestQuery.pagination?.itemsPerPage ?? 10) + index + 1;
    },
    async synchronize(response: CollectionResponse<DatasetRecord>) {
      const current = await currentResponse();
      Object.assign(response, current);
      for (const options of optionsByResponse.get(response) ?? []) syncOptions(options);
    },
    async list(options: ListOptions = {}) {
      latest = (async () => {
        const query = normalizeTableQuery(options, selected);
        const name = String(query.filters?.name__match ?? "");
        if (previousName !== undefined && name !== previousName && query.pagination) query.pagination.page = 1;
        previousName = name;
        latestQuery = query;
        return datasets.list(query);
      })();
      const response = await currentResponse();
      syncOptions(options);
      optionsByResponse.set(response, [...(optionsByResponse.get(response) ?? []), options]);
      return response;
    },
  };
}
