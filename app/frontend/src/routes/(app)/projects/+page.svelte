<script lang="ts">
	import Button from "@/components/ui/button/button.svelte";
	import DataTable from "@/components/app/data-table/DataTable.svelte";
	import Page from "@/components/app/page/Page.svelte";
	import PageHeader from "@/components/app/page/PageHeader.svelte";
	import ProjectFormModal from "@/components/app/workflow/projects/overlays/ProjectFormModal.svelte";
	import { PlusIcon } from "@lucide/svelte";

	import { projectColumns } from "@/components/app/workflow/projects/data-tables/project.columns";

	// Variables
	let openNewProjectModal: boolean = false;
</script>

<Page name="projects">
	<PageHeader title="Projects">
		{#snippet actions()}
			<Button onclick={() => (openNewProjectModal = true)}>
				<PlusIcon class="size-4" />
				New Project
			</Button>
		{/snippet}
	</PageHeader>

	<DataTable id="projects" name="project" columns={projectColumns} />
</Page>

<ProjectFormModal title="Project" action="create" bind:open={openNewProjectModal} />
