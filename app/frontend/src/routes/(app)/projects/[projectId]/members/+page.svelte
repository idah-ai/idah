<script lang="ts">
	import Button from "@/components/ui/button/button.svelte";
	import DataTable from "@/components/app/data-table/data-table.svelte";
	import ProjectMemberFormModal from "@/components/app/projects/members/overlays/project-member-form-modal.svelte";

	import { projectMemberColumns } from "@/components/app/projects/members/data-tables/project-member.columns";
	import { PlusIcon } from "@lucide/svelte";

	// Variables
	let openNewProjectMemberFormModal: boolean = $state(false);
</script>

<DataTable id="project-members" name="member" columns={projectMemberColumns}>
	{#snippet actions()}
		<Button onclick={() => (openNewProjectMemberFormModal = true)}>
			<PlusIcon class="size-4" />
			Invite Members
		</Button>
	{/snippet}
</DataTable>

<ProjectMemberFormModal action="create" title="Members" bind:open={openNewProjectMemberFormModal} />
