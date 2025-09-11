import ProjectMemberRoleCell from "@/components/app/projects/members/data-tables/project-member-role-cell.svelte";
import ProjectMemberJoinedAtCell from "@/components/app/projects/members/data-tables/project-member-joined-at-cell.svelte";
import ProjectMemberRowActionCell from "@/components/app/projects/members/data-tables/project-member-row-action-cell.svelte";

import { projectMemberRoles, type ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";

import type { ColumnsSettings } from "@/components/app/data-table/data-table.types";

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
  joined_at: {
    label: "Joined date",
    dataType: "datetime",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ProjectMemberJoinedAtCell,
  },
  role: {
    label: "Role",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "role",
      filterBy: "multiple-select",
      filterOperation: "in",
      choices: projectMemberRoles,
    },
    visible: true,
    hidable: false,
    cellComponent: ProjectMemberRoleCell,
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
