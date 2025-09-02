<script lang="ts">
	import Button from "@/components/ui/button/button.svelte";
	import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuGroup,
		DropdownMenuItem,
		DropdownMenuTrigger,
	} from "@/components/ui/dropdown-menu";
	import ProjectFormModal from "@/components/app/workflow/projects/overlays/ProjectFormModal.svelte";

	import { EllipsisVerticalIcon, SquarePenIcon, Trash2Icon } from "@lucide/svelte";

	// Variables
	const menus = [
		{ label: "Edit", icon: SquarePenIcon, action: () => (openEditProjectFormModal = true) },
		{ label: "Delete", icon: Trash2Icon, action: () => (openConfirmDeleteProjectModal = true) },
	];

	let openEditProjectFormModal: boolean = $state(false);
	let openConfirmDeleteProjectModal: boolean = $state(false);
</script>

<DropdownMenu>
	<DropdownMenuTrigger>
		{#snippet child({ props })}
			<Button variant="ghost" size="icon" {...props}>
				<EllipsisVerticalIcon class="size-4" />
			</Button>
		{/snippet}
	</DropdownMenuTrigger>

	<DropdownMenuContent align="end">
		<DropdownMenuGroup>
			{#each menus as { label, icon: Icon, action }}
				<DropdownMenuItem onclick={action}>
					<Icon class="size-4" />
					{label}
				</DropdownMenuItem>
			{/each}
		</DropdownMenuGroup>
	</DropdownMenuContent>
</DropdownMenu>

<ProjectFormModal title="Project" action="update" bind:open={openEditProjectFormModal} />

<ConfirmModal
	title="Delete Project"
	description="Are you sure you want to delete this project?"
	bind:open={openConfirmDeleteProjectModal}
></ConfirmModal>
