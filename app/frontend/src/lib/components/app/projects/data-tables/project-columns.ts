import ProjectNameCell from "@/components/app/projects/data-tables/project-name-cell.svelte";
import ProjectLabelsCell from "@/components/app/projects/data-tables/project-labels-cell.svelte";
import ProjectDataRowsCell from "@/components/app/projects/data-tables/project-data-rows-cell.svelte";
import ProjectCompletedCell from "@/components/app/projects/data-tables/project-completed-cell.svelte";
import ProjectRowActionCell from "@/components/app/projects/data-tables/project-row-action-cell.svelte";

import type { ColumnsSettings } from "@/components/app/data-table/data-table.types";
import type { ProjectRecord } from "@/data/model/dataset/projects/project-record";

export const projectColumns: ColumnsSettings<ProjectRecord> = {
  name: {
    label: "Project name",
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
    cellComponent: ProjectNameCell,
  },
  lables: {
    label: "Labels",
    dataType: "number",
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ProjectLabelsCell,
  },
  rows: {
    label: "Data Rows",
    dataType: "number",
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ProjectDataRowsCell,
  },
  completed: {
    label: "Completed",
    dataType: "number",
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ProjectCompletedCell,
  },
  updated_at: {
    label: "Updated",
    dataType: "datetime",
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "updated_at",
      filterBy: "date-range",
      filterOperation: "match",
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
    cellComponent: ProjectRowActionCell,
  },
};
