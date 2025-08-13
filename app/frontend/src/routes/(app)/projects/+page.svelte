<script lang="ts">
	import Page from "$/lib/components/app/page/Page.svelte";
	import PageHeader from "$/lib/components/app/page/PageHeader.svelte";
	import ProjectFormModal from "$/lib/components/app/workflow/projects/overlays/ProjectFormModal.svelte";
	import Button from "$/lib/components/ui/button/button.svelte";
	import { PlusIcon } from "@lucide/svelte";

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
</Page>

<ProjectFormModal title="Project" action="create" bind:open={openNewProjectModal} />
