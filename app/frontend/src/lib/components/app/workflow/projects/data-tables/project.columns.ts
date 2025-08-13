import type { ColumnsSettings } from "$lib/components/app/data-table/DataTable.types";

export const projectColumns: ColumnsSettings = {
	name: {
		label: "Project name",
		dataType: "string",
		sortable: true,
		filterable: true,
		filterOptions: {
			filterKey: "name",
			filterBy: "string",
			filterOperation: "match",
		},
		visible: true,
		hidable: false,
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
		label: "Rows",
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
};
