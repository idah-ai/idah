<script lang="ts">
	import { format, subDays } from "date-fns";

	import Button from "@/components/ui/button/button.svelte";
	import DataTable from "@/components/app/data-table/data-table.svelte";
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuGroup,
		DropdownMenuItem,
		DropdownMenuTrigger,
	} from "@/components/ui/dropdown-menu";

	import { projectAnalyticMemberPerformanceColumns } from "@/components/app/projects/analytics/data-tables/project-analytic.columns";
	import { ChevronsUpDownIcon } from "@lucide/svelte";

	// Variables
	const today: Date = new Date();
	const dateFormat: string = "yyyy-MM-dd";

	let selectedDuration: string = $state(format(today, dateFormat));
	let durations = [
		{ label: "Today", value: format(today, dateFormat) },
		{ label: "Last 7 days", value: format(subDays(today, 7), dateFormat) },
		{ label: "Last 30 days", value: format(subDays(today, 30), dateFormat) },
		{ label: "Last Month", value: format(subDays(today, 30), dateFormat) },
		{ label: "Last Quarter", value: format(subDays(today, 90), dateFormat) },
	];
</script>

<DataTable
	id="project-analytic-member-performance"
	name="project analytic member performance"
	title="Members Performance"
	columns={projectAnalyticMemberPerformanceColumns}
>
	{#snippet actions()}
		<DropdownMenu>
			<DropdownMenuTrigger>
				{#snippet child({ props })}
					<Button variant="outline" {...props}>
						{durations.find((duration) => duration.value === selectedDuration)?.label ?? "Select Duration"}

						<ChevronsUpDownIcon class="ml-2 size-4" />
					</Button>
				{/snippet}
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end">
				<DropdownMenuGroup>
					{#each durations as { label, value }}
						<DropdownMenuItem>{label}</DropdownMenuItem>
					{/each}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	{/snippet}
</DataTable>
