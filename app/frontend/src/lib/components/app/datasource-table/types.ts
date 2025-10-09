import type { Component, Snippet } from "svelte";
import type { Writable } from "svelte/store";

import type { LabelValue } from "@/components/app/types";
import type { BackendDataSource } from "@/data/BackendDataSource";
import type { ListOptions, Pagination, Sort } from "@/data/DataSource";
import type { Filters } from "@/data/filtering";
import type { Record } from "@/data/model/Record";
import type { CollectionResponse } from "@/data/model/types";
import type { RefetchesKey } from "@/utils/refetch";
import type { Hash } from "@/utils/types";

export type DataTableColumnDataType =
  | "string"
  | "boolean"
  | "number"
  | "date"
  | "datetime"
  | "email"
  | "file"
  | "time"
  | "enum";

export type DataTableColumnFilterBy =
  | "string"
  | "boolean"
  | "number-range"
  | "multiple-select"
  | "date-range"
  | "datasource";

export type DataTableColumnFilterOperation =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "nin"
  | "contains"
  | "match";

export interface ColumnSettings<T extends Record> {
  label: string;
  dataType: DataTableColumnDataType;
  clickable?: boolean;
  sortable: boolean;
  filterable: boolean;
  filterOptions?: {
    filterKey: string;
    filterBy: DataTableColumnFilterBy;
    filterOperation: DataTableColumnFilterOperation;
    choices?: LabelValue<string | number | boolean>[];
  };

  filterComponent?: Component<DataTableFilterBaseProps<T>, object, "">;
  align?: "left" | "center" | "right";
  visible: boolean;
  hidable: boolean;

  cellComponent?: Component<DataTableCellBaseProps<T>, object, "">;
  cellComponentProps?: Hash;
  cellOptions?: {
    enums: LabelValue<string | number | boolean>[];
  };
}

export interface ColumnsSettings<T extends Record> {
  [fieldName: string]: ColumnSettings<T>;
}

export interface DataTableBaseProps<T extends Record> {
  /**
   * Unique identifier for the data table
   * This is used to track the table's state and data from local or session storage.
   */
  id: string;
  name: string;
  title?: string;
  refetchKey: RefetchesKey;
  dataSource: BackendDataSource<T>;
  listOptions?: ListOptions;
  columns: ColumnsSettings<T>;
  hidePagination?: boolean;

  // Functions
  onLoadSetContexts?: (response: CollectionResponse<T>) => Promise<Hash>;

  // Snippets
  actions?: Snippet;
  addNewRecordButton?: Snippet;
  emptyState?: Snippet;
  filteredState?: Snippet;
}

export interface DataTableFilterBaseProps<T extends Record> {
  columnSetting: ColumnSettings<T>;
  contexts?: Hash;
  filters: Filters;
  onFilter: (params: FilterDataSourceParams) => Promise<void> | void;
}

export interface DataTableCellBaseProps<T extends Record> {
  record: T;
  contexts?: Hash;
}

export interface TablePreferences {
  selectedRows: Array<string>;
  filters: Filters;
  pagination: Pagination;
  sort: Sort;
}

export type TableStatus = "loading" | "loaded" | "error";

export interface TableData<T extends Record> {
  status: TableStatus;
  error?: unknown;
  response: CollectionResponse<T>;
  contexts?: Hash;
}

export interface TableState<T extends Record> {
  tableData: Writable<TableData<T>>;
  tablePreferences: Writable<TablePreferences>;
}

export interface FilterDataSourceParams {
  filters: Filters;
}

export interface SortDataSourceParams {
  columnKey: string;
  sortDirection: "asc" | "desc" | "none";
}
