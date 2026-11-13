import type { Record } from "@/data/model/Record";
import type { Hash } from "@/utils/types";
import type { Component } from "svelte";

export interface DataTableColumnSetting<T extends Record> {
  key: string;
  title: string;
  align?: "left" | "center" | "right"; // default: left
  cellComponent?: Component<{ row: T }>;
  // Extend more attributes for DataTable column
}

export interface DataTableColumnSettings<T extends Record> {
  [column: string]: DataTableColumnSetting<T>;
}

export type DataTableRows<T extends Record> = Array<T>;
