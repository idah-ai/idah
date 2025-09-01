<script lang="ts">
	import DataTableBody from "@/components/app/data-table/DataTableBody.svelte";
	import DataTableContent from "@/components/app/data-table/DataTableContent.svelte";
	import DataTableHeader from "@/components/app/data-table/DataTableHeader.svelte";
	import DataTableHeadLabel from "@/components/app/data-table/DataTableHeadLabel.svelte";
	import DataTableHeadOptions from "@/components/app/data-table/DataTableHeadOptions.svelte";
	import DataTablePaginator from "@/components/app/data-table/DataTablePaginator.svelte";
	import DataTableToggleColumns from "@/components/app/data-table/DataTableToggleColumns.svelte";
	import DataTableToolbarActions from "@/components/app/data-table/DataTableToolbarActions.svelte";
	import Table from "@/components/ui/table/table.svelte";
	import TableHead from "@/components/ui/table/table-head.svelte";
	import TableHeader from "@/components/ui/table/table-header.svelte";
	import TableRow from "@/components/ui/table/table-row.svelte";
	import Text from "@/components/ui/text/Text.svelte";

	import { cn } from "@/utils";

	import type { DataTableBaseProps } from "@/components/app/data-table/DataTable.types";

	// Props
	interface Props extends DataTableBaseProps {}
	let { id, name: dataTableName, title, columns: _columns, hidePagination, actions }: Props = $props();

	// Variables
	let columns = $state(_columns);
	let haveSomeHidableColumns: boolean = $derived(Object.values(columns).some((column) => column.hidable));
 
	let currentPage: number = $state(1);
	let itemsPerPage: number = $state(10);
  
	let records: Record<string, string>[] = $state([]);
	records = getSampleData();

	// Functions
	function getSampleData() {
		let datas = [];

		for (let index = 0; index <= 10; index++) {
			const cols = Object.keys(columns);
			let data: Record<string, unknown> = {};

			data["id"] = index + 1;

			for (const col of cols) {
				if (columns[col].visible) {
					data[col] = `Sample ${col} ${index}`;
				}
			}

			datas.push(data);
		}

		return datas;
	}

	function hideColumn(columnToHide: string): void {
		columns[columnToHide].visible = false;
	}
</script>

<div id="data-table-container" class="flex flex-1 flex-col gap-2">
	<DataTableHeader>
		<!-- DATA TABLE::TITLE -->
		{#if title}
			<Text size="h3" weight="semibold">{title}</Text>
		{/if}

		<!-- DATA TABLE::ACTIONS -->
		<DataTableToolbarActions>
			{#if haveSomeHidableColumns}
				<DataTableToggleColumns {columns} />
			{/if}

			{@render actions?.()}
		</DataTableToolbarActions>
	</DataTableHeader>

	<!-- DATA TABLE::TABLE -->
	<DataTableContent>
		<Table>
			<!-- DATA TABLE::TABLE::HEADER -->
			<TableHeader>
				<TableRow>
					{#each Object.entries(columns) as [columnKey, columnSetting] (columnKey)}
						{@const { label, align, filterable, sortable, visible } = columnSetting}
						{#if visible}
							<TableHead
								class={cn(
									"bg-primary/10 first:rounded-tl-md last:rounded-tr-md",
									align ? `text-${align}` : "text-left",
								)}
							>
								{#if !filterable && !sortable}
									<DataTableHeadLabel>{label}</DataTableHeadLabel>
								{:else}
									<DataTableHeadOptions {dataTableName} {columnKey} {columnSetting} onHide={hideColumn}
									></DataTableHeadOptions>
								{/if}
							</TableHead>
						{/if}
					{/each}
				</TableRow>
			</TableHeader>

			<!-- DATA TABLE::TABLE::ROWS -->
			<!-- {#if loading}
					 <DataTableBodyLoading></DataTableBodyLoading>
					 {:else} -->
			<DataTableBody {dataTableName} {records} {columns}></DataTableBody>
			<!-- {/if} -->
		</Table>
	</DataTableContent>

	<!-- DATA TABLE::PAGINATION -->
	{#if !hidePagination}
		<DataTablePaginator bind:page={currentPage} bind:itemsPerPage />
	{/if}
</div>
