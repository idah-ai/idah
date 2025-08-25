<script lang="ts">
	import TableBody from "@/components/ui/table/table-body.svelte";
	import TableCell from "@/components/ui/table/table-cell.svelte";
	import TableRow from "@/components/ui/table/table-row.svelte";

	import { cn } from "@/utils";

	import type { ColumnsSettings } from "@/components/app/data-table/DataTable.types";

	// Props
	interface Props {
		dataTableName: string;
		records: Record<string, unknown>[];
		columns: ColumnsSettings;
	}
	let { dataTableName, records, columns }: Props = $props();

	// Variables
	let hasRecords = $derived(records.length > 0);
</script>

<TableBody>
	{#if hasRecords}
		{#each records as record}
			<TableRow>
				{#each Object.entries(columns) as [columnKey, columnSetting] (columnKey)}
					{@const { dataType, clickable, cellComponent: CellComponent, visible } = columnSetting}
					{@const value = record[columnKey] || ""}

					{#if visible}
						<TableCell
							class={cn("px-6 py-4", {
								"cursor-pointer": clickable,
							})}
						>
							{#if CellComponent}
								<CellComponent this={columnSetting.cellComponent} {record} />
							{:else if dataType === "string"}
								{value}
							{:else if dataType === "number"}
								{value}
							{:else if dataType === "email"}
								{value}
							{:else if dataType === "date"}
								{value}
							{:else if dataType === "datetime"}
								{value}
							{:else if dataType === "time"}
								{value}
							{:else if dataType === "enum"}
								{value}
							{/if}
						</TableCell>
					{/if}
				{/each}
			</TableRow>
		{/each}
	{:else}
		<TableRow>
			<TableCell>No {dataTableName || "records"} found.</TableCell>
		</TableRow>
	{/if}
</TableBody>
