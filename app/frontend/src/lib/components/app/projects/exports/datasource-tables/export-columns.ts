import type { ColumnsSettings } from "@/components/app/datasource-table/types";
import type { SyncJobRecord } from "@/data/model/sync/jobs/record";
import ExportArgumentsCell from "./export-arguments-cell.svelte";
import ExportDownloadCell from "./export-download-cell.svelte";
import ExportProgressCell from "./export-progress-cell.svelte";

export const exportsColumns: ColumnsSettings<SyncJobRecord> = {
  progress: {
    label: "progress",
    dataType: "number",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "progress",
      filterBy: "number-range",
      filterOperation: "eq",
    },
    visible: true,
    hidable: false,
    cellComponent: ExportProgressCell,
  },
  arguments: {
    label: "Arguments",
    dataType: "string",
    clickable: false,
    sortable: false,
    filterable: false,
    // filterOptions: {
    // filterKey: "progress",
    // filterBy: "number-range",
    // filterOperation: "eq",
    // },
    visible: true,
    hidable: false,
    cellComponent: ExportArgumentsCell,
  },
  action: {
    label: "Action",
    dataType: "file",
    clickable: false,
    sortable: false,
    filterable: false,
    // filterOptions: {
    // filterKey: "progress",
    // filterBy: "number-range",
    // filterOperation: "eq",
    // },
    visible: true,
    hidable: false,
    cellComponent: ExportDownloadCell,
  },
};
