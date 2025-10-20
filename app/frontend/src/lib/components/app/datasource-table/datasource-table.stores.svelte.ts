import { writable, type Writable } from "svelte/store";

import { Record } from "@/data/model/Record";

import type { TableData, TablePreferences, TableState } from "@/components/app/datasource-table/types";

const DATA_TABLE_PREFIX: string = "settings:data-tables";
const defaultTablePreferences: TablePreferences = {
  selectedRows: [],
  filters: {},
  pagination: {
    page: 1,
    itemsPerPage: 10,
  },
  sort: ["-id"],
};

export function getTablePreferences(dataTableId: string): Writable<TablePreferences> {
  const sessionStorageKey: string = `${DATA_TABLE_PREFIX}:${dataTableId}`;
  const sessionStorageTablePreferences = sessionStorage.getItem(sessionStorageKey);

  let tablePreferences: Writable<TablePreferences>;

  if (sessionStorageTablePreferences) {
    try {
      tablePreferences = writable<TablePreferences>(JSON.parse(sessionStorageTablePreferences));
    } catch (error) {
      tablePreferences = writable<TablePreferences>(defaultTablePreferences);
      throw error;
    }
  } else {
    tablePreferences = writable<TablePreferences>(defaultTablePreferences);
  }

  tablePreferences.subscribe((value) => {
    sessionStorage.setItem(sessionStorageKey, JSON.stringify(value));
  });

  return tablePreferences;
}

export function getTableState<T extends Record>(dataTableId: string): TableState<T> {
  const tableData = writable<TableData<T>>({
    status: "loading",
    response: { data: [], meta: {} },
  });

  const tablePreferences = getTablePreferences(dataTableId);

  tablePreferences.subscribe((value) => {
    sessionStorage.setItem(`${DATA_TABLE_PREFIX}:${dataTableId}`, JSON.stringify(value));
  });

  return {
    tableData,
    tablePreferences,
  };
}

export function getDataTableSessionStorage(dataTableId: string): string | null {
  return sessionStorage.getItem(`${DATA_TABLE_PREFIX}:${dataTableId}`);
}
