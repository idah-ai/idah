<script lang="ts">
	import Button from "@/components/ui/button/button.svelte";
	import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";

	import { Trash2Icon } from "@lucide/svelte";

	// Props
	interface Props {
		record: Record<string, unknown>;
	}
	let { record: projectMember }: Props = $props();

	// Variables
	let openConfirmRemoveMemberModal: boolean = $state(false);
</script>

<Button variant="ghost" size="icon" onclick={() => (openConfirmRemoveMemberModal = true)}>
	<Trash2Icon class="size-4" />
</Button>

<ConfirmModal
	title="Remove member"
	description="Are you sure you want to remove this member from the project?"
	bind:open={openConfirmRemoveMemberModal}
></ConfirmModal>
