import ProjectMemberAccessCell from "@/components/app/projects/members/datasource-tables/project-member-access-cell.svelte";
import ProjectMemberRowActionCell from "@/components/app/projects/members/datasource-tables/project-member-row-action-cell.svelte";

import { ProjectMemberRecord, projectMemberAccess } from "@/data/model/dataset/projects/members/record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

export const projectMemberColumns: ColumnsSettings<ProjectMemberRecord> = {
  email: {
    label: "Email",
    dataType: "email",
    clickable: true,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "email",
      filterBy: "string",
      filterOperation: "match",
    },
    visible: true,
    hidable: false,
  },
  created_at: {
    label: "Invited date",
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
  access: {
    label: "Access",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "access",
      filterBy: "multiple-select",
      filterOperation: "in",
      choices: projectMemberAccess,
    },
    visible: true,
    hidable: false,
    cellComponent: ProjectMemberAccessCell,
  },
  action: {
    label: "Action",
    dataType: "string",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ProjectMemberRowActionCell,
  },
};
