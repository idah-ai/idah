import ExportDatasetFormatCell from "@/components/app/projects/exports/datasource-tables/export-dataset-format-cell.svelte";
import ExportDatasetIncludedMediasCell from "@/components/app/projects/exports/datasource-tables/export-dataset-included-medias-cell.svelte";
import ExportDatasetNameCell from "@/components/app/projects/exports/datasource-tables/export-dataset-name-cell.svelte";
import ExportDatasetStatusCell from "@/components/app/projects/exports/datasource-tables/export-dataset-status-cell.svelte";
import ExportRowActionCell from "@/components/app/projects/exports/datasource-tables/export-row-action-cell.svelte";

import { ExportRecord } from "@/data/model/sync/exports/record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

export const exportsColumns: ColumnsSettings<ExportRecord> = {
  id: {
    label: "Datasets name",
    dataType: "string",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ExportDatasetNameCell,
  },
  exporter: {
    label: "Format",
    dataType: "string",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ExportDatasetFormatCell,
  },
  included_medias: {
    label: "Included Medias",
    dataType: "string",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ExportDatasetIncludedMediasCell,
  },
  created_at: {
    label: "Exported at",
    dataType: "datetime",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "created_at",
      filterBy: "date-range",
      filterOperation: "gte",
    },
    visible: true,
    hidable: false,
  },
  status: {
    label: "Status",
    dataType: "enum",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ExportDatasetStatusCell,
  },
  action: {
    label: "Action",
    dataType: "string",
    align: "right",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ExportRowActionCell,
  },
};
