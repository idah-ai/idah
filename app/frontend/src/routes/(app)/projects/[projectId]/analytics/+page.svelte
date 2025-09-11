<script lang="ts">
	import ProjectAnalyticOverview from "@/components/app/projects/analytics/project-analytic-overview.svelte";
	import ProjectAnalyticPerformance from "@/components/app/projects/analytics/project-analytic-performance.svelte";
	import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

	import {
		projectAnalyticTabs,
		type ProjectAnalyticTab,
	} from "@/components/app/projects/analytics/tabs/project-analytic.tabs";

	// Variables
	let activeTab: ProjectAnalyticTab = $state("overview");
</script>

<Tabs bind:value={activeTab}>
	<TabsList>
		{#each projectAnalyticTabs as { label, value } (value)}
			<TabsTrigger {value}>{label}</TabsTrigger>
		{/each}
	</TabsList>

	<TabsContent value="overview" class="pt-4">
		<ProjectAnalyticOverview />
	</TabsContent>

	<TabsContent value="performance" class="pt-4">
		<ProjectAnalyticPerformance />
	</TabsContent>
</Tabs>
