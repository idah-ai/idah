import ProjectDatasetNameCell from "@/components/app/datasets/data-tables/project-dataset-name-cell.svelte";
import ProjectDatasetRowActionCell from "@/components/app/datasets/data-tables/project-dataset-row-action-cell.svelte";

import { DatasetRecord } from "@/data/model/dataset/dataset-record";

import type { ColumnsSettings } from "@/components/app/data-table/data-table.types";

export const projectDatasetColumns: ColumnsSettings<DatasetRecord> = {
  name: {
    label: "Dataset Name",
    dataType: "string",
    clickable: true,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "name",
      filterBy: "string",
      filterOperation: "match",
    },
    visible: true,
    hidable: false,
    cellComponent: ProjectDatasetNameCell,
  },
  status: {
    label: "Status",
    dataType: "enum",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "status",
      filterBy: "multiple-select",
      filterOperation: "in",
    },
    visible: true,
    hidable: false,
  },
  progress: {
    label: "Progress",
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
  },
  modality: {
    label: "Media Type",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "modality",
      filterBy: "string",
      filterOperation: "match",
    },
    visible: true,
    hidable: false,
  },
  created_at: {
    label: "Created at",
    dataType: "datetime",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "created_at",
      filterBy: "date-range",
      filterOperation: "eq",
    },
    visible: true,
    hidable: false,
  },
  updated_at: {
    label: "Last updated",
    dataType: "datetime",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "updated_at",
      filterBy: "date-range",
      filterOperation: "eq",
    },
    visible: true,
    hidable: false,
  },
  action: {
    label: "Action",
    dataType: "string",
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ProjectDatasetRowActionCell,
  },
};
