import type { Record } from "@/data/model/Record";
import type { Component } from "svelte";

export interface DataTableColumnSetting<T extends Record> {
  key: string;
  title: string;
  align?: "left" | "center" | "right"; // default: left
  cellComponent?: Component<{ row: T }>;
  sortable?: boolean; // enables column header sorting
}

export interface DataTableColumnSettings<T extends Record> {
  [column: string]: DataTableColumnSetting<T>;
}

export interface DataTableSortState {
  key: string;
  dir: "asc" | "desc";
}

export type DataTableRows<T extends Record> = Array<T>;

export interface IDataTablePagination {
  count: number;
  page: number;
  itemsPerPage: number;
  hasMore: boolean;
}
