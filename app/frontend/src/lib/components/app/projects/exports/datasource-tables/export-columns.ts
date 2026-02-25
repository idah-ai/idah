import ExportRowActionCell from "@/components/app/projects/exports/datasource-tables/export-row-action-cell.svelte";

import { ExportRecord } from "@/data/model/sync/exports/record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

export const exportsColumns: ColumnsSettings<ExportRecord> = {
  id: {
    label: "ID",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "id",
      filterBy: "string",
      filterOperation: "match",
    },
    visible: true,
    hidable: false,
  },
  action: {
    label: "Action",
    dataType: "string",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ExportRowActionCell,
  },
};
