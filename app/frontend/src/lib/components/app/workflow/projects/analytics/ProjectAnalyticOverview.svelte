<script lang="ts">
	import StatsCard from "@/components/app/cards/StatsCard.svelte";
	import StackedProgressBar from "@/components/app/charts/bars/StackedProgressBar.svelte";
	import DataTable from "@/components/app/data-table/DataTable.svelte";

	import { projectAnalyticOverviewColumns } from "@/components/app/workflow/projects/analytics/data-tables/project-analytic.columns";

	// Variables
	let values = [
		{ label: "Todo", value: 10, bgColor: "bg-gray-300", textColor: "text-accent-foreground" },
		{ label: "Annotated", value: 20, bgColor: "bg-blue-500" },
		{ label: "To review", value: 30, bgColor: "bg-amber-500" },
		{ label: "Reviewed", value: 50, bgColor: "bg-emerald-500" },
	];
</script>

<div class="grid w-full gap-4">
	<!-- METRICS CARD -->
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-5">
		<StatsCard title="Total" value="45,789" />
		<StatsCard title="Remaning" value="3,205" />
		<StatsCard title="Annotated" value="68,683" />
		<StatsCard title="Reviewed" value="34,799" />
		<StatsCard title="Skipped" value="5" />
	</div>

	<!-- STACKED PROGRESS BAR -->
	<StackedProgressBar {values} />

	<!-- DATA TABLE -->
	<DataTable
		id="project-analytics-overview"
		name="project analytic overview"
		columns={projectAnalyticOverviewColumns}
	/>
</div>
