import ProjectMemberRoleCell from "@/components/app/projects/members/data-tables/project-member-role-cell.svelte";
import ProjectMemberRowActionCell from "@/components/app/projects/members/data-tables/project-member-row-action-cell.svelte";

import type { ColumnsSettings } from "@/components/app/data-table/data-table.types";

export const projectMemberColumns: ColumnsSettings = {
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
	invited_at: {
		label: "Invited date",
		dataType: "datetime",
		clickable: false,
		sortable: true,
		filterable: true,
		filterOptions: {
			filterKey: "invited_at",
			filterBy: "date-range",
			filterOperation: "match",
		},
		visible: true,
		hidable: false,
	},
	joined_at: {
		label: "Joined date",
		dataType: "datetime",
		clickable: false,
		sortable: true,
		filterable: true,
		filterOptions: {
			filterKey: "joined_at",
			filterBy: "date-range",
			filterOperation: "match",
		},
		visible: true,
		hidable: false,
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
			filterOperation: "match",
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
