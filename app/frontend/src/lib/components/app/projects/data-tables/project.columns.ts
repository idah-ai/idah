import ProjectNameCell from "@/components/app/projects/data-tables/project-name-cell.svelte";
import ProjectRowActionCell from "@/components/app/projects/data-tables/project-row-action-cell.svelte";

import type { ColumnsSettings } from "@/components/app/data-table/data-table.types";

export const projectColumns: ColumnsSettings = {
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
		sortable: true,
		filterable: true,
		filterOptions: {
			filterKey: "labels",
			filterBy: "number-range",
			filterOperation: "match",
		},
		visible: true,
		hidable: false,
	},
	rows: {
		label: "Data Rows",
		dataType: "number",
		sortable: true,
		filterable: true,
		filterOptions: {
			filterKey: "rows",
			filterBy: "number-range",
			filterOperation: "match",
		},
		visible: true,
		hidable: false,
	},
	completed: {
		label: "Completed",
		dataType: "number",
		sortable: true,
		filterable: true,
		filterOptions: {
			filterKey: "completed",
			filterBy: "number-range",
			filterOperation: "match",
		},
		visible: true,
		hidable: false,
	},
	updated: {
		label: "Updated",
		dataType: "datetime",
		sortable: true,
		filterable: true,
		filterOptions: {
			filterKey: "updated",
			filterBy: "date-range",
			filterOperation: "match",
		},
		visible: true,
		hidable: true,
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
