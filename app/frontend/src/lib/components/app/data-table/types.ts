import type { Record } from "@/data/model/Record";
import type { Component } from "svelte";
import type { ListOptions } from "@/data/DataSource";

export interface DataTableColumnSetting<T extends Record> {
  key: string;
  title: string;
  align?: "left" | "center" | "right"; // default: left
  cellComponent?: Component<{ row: T }>;
  headerComponent?: Component;
  sortable?: boolean;
}

export interface DataTableColumnSettings<T extends Record> {
  [column: string]: DataTableColumnSetting<T>;
}

/** Sort expressions follow the API convention: `-field` = DESC.
 *  Extend with more `ListOptions` keys as needed (pagination, filters, …). */
export type DataTableListOptions = Pick<ListOptions, "sort">;

export type DataTableRows<T extends Record> = Array<T>;

export interface IDataTablePagination {
  count: number;
  page: number;
  itemsPerPage: number;
  hasMore: boolean;
}
