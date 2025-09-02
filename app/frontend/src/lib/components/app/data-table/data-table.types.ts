import type { Component, Snippet } from "svelte";
import type { LabelValue } from "$lib/components/app/ComponentApp.types";

export type DataTableColumnDataType = "string" | "number" | "date" | "datetime" | "email" | "file" | "time" | "enum";

export type DataTableColumnFilterBy =
	| "string"
	| "number-range"
	| "single-select"
	| "multiple-select"
	| "date-range"
	| "datasource";

export type DataTableColumnFilterOperation =
	| "eq"
	| "neq"
	| "gt"
	| "gte"
	| "lt"
	| "lte"
	| "in"
	| "nin"
	| "contains"
	| "match";

export interface ColumnSettings {
	label: string;
	dataType: DataTableColumnDataType;
	clickable?: boolean;
	sortable: boolean;
	filterable: boolean;
	filterOptions?: {
		filterKey: string;
		filterBy: DataTableColumnFilterBy;
		filterOperation: DataTableColumnFilterOperation;
		choices?: LabelValue<string | number | boolean>[];
	};
	filterComponent?: Component;
	align?: "left" | "center" | "right";
	visible: boolean;
	hidable: boolean;
	cellComponent?: Component<DataTableCellBaseProps, {}, "">;
	cellComponentProps?: Record<string, any>;
	cellOptions?: {
		enums: LabelValue<string | number | boolean>[];
	};
}

export interface ColumnsSettings {
	[fieldName: string]: ColumnSettings;
}

export interface DataTableBaseProps {
	/**
	 * Unique identifier for the data table
	 * This is used to track the table's state and data from local or session storage.
	 */
	id: string;
	name: string;
	title?: string;
	// dataSource
	// listOptions
	columns: ColumnsSettings;
	hidePagination?: boolean;

	// Snippets
	actions?: Snippet;
}

export interface DataTableCellBaseProps {
	record: Record<string, unknown>;
}
