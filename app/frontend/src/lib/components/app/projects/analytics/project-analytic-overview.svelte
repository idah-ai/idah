<script lang="ts">
	import DataTable from "@/components/app/data-table/data-table.svelte";
	import MetricCard from "@/components/app/cards/metric-card.svelte";
	import StackedProgressBar from "@/components/app/charts/bars/stacked-progress-bar.svelte";

	import { projectAnalyticOverviewColumns } from "@/components/app/projects/analytics/data-tables/project-analytic.columns";

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
		<MetricCard title="Total" value="45,789" />
		<MetricCard title="Remaning" value="3,205" />
		<MetricCard title="Annotated" value="68,683" />
		<MetricCard title="Reviewed" value="34,799" />
		<MetricCard title="Skipped" value="5" />
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
