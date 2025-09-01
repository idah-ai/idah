<script lang="ts">
	import { onMount, type Snippet } from "svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";

	import Page from "@/components/app/page/Page.svelte";
	import PageHeader from "@/components/app/page/PageHeader.svelte";
	import ProjectDropdownMenu from "@/components/app/workflow/projects/dropdowns/ProjectDropdownMenu.svelte";
	import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

	import { projectBreadcrumb } from "@/components/app/page/PageBreadcrumb.constants";
	import { projectTabs, type ProjectTab } from "@/components/app/workflow/projects/tabs/project.tabs";

	import type { PageBreadcrumbItem } from "@/components/app/page/PageBreadcrumb.svelte";

	// Props
	interface Props {
		children: Snippet;
	}
	let { children }: Props = $props();

	// Variables
	let projectId: string = page.params.projectId as string;
	let activeTab: ProjectTab = $derived(page.url.pathname.split("/").pop() as ProjectTab);
	let breadcrumbs: PageBreadcrumbItem[] = $state([projectBreadcrumb, { label: projectId }]);

	// Lifecycle
	onMount(() => {
		const currentTab = projectTabs.find((tab) => tab.value === activeTab);
		const defaultProjectTab: ProjectTab = "tasks";

		if (!currentTab) {
			goto(`/projects/${projectId}/${defaultProjectTab}`);
		} else {
			goto(`/projects/${projectId}/${currentTab.value}`);
		}
	});

	// Functions
	function handleTabChange(value: ProjectTab): void {
		goto(`/projects/${projectId}/${value}`);
	}
</script>

<Page name="project-detail" {breadcrumbs}>
	<PageHeader title="Video Tracking">
		{#snippet actions()}
			<ProjectDropdownMenu />
		{/snippet}
	</PageHeader>

	<Tabs bind:value={activeTab}>
		<TabsList>
			{#each projectTabs as { label, value } (value)}
				<TabsTrigger {value} onclick={() => handleTabChange(value)}>{label}</TabsTrigger>
			{/each}
		</TabsList>
	</Tabs>

	{@render children()}
</Page>
