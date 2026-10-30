export interface DatasetStatsSyncContext {
  start: () => void;
}

export const datasetStatsSyncContext = Symbol("dataset-stats-sync");
