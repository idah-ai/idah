<script lang="ts">
	import Button from "@/components/ui/button/button.svelte";
	import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";
	import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
	import ProjectMemberForm from "@/components/app/projects/members/forms/project-member-form.svelte";

	import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

	// Props
	interface Props extends FormModalBaseProps {}
	let { action, open = $bindable() }: Props = $props();

	// Variables
	let members: Array<{ email: string; role: string }> = $state([{ email: "", role: "" }]);

	// Functions
	function closeThisModal(): void {
		open = false;
	}

	function resetForm(): void {
		members = [{ email: "", role: "" }];
	}

	async function submit(): Promise<void> {
		try {
		} catch (error) {
		} finally {
			closeThisModal();
		}
	}
</script>

<FormModal {action} title="Members" onCancel={resetForm} onConfirm={submit} bind:open>
	{#snippet modalTitle()}
		<DialogTitle>Invite Members</DialogTitle>
	{/snippet}

	<ProjectMemberForm bind:members />

	{#snippet confirm()}
		<Button disabled={members.length === 0} onclick={submit}>Send Invite</Button>
	{/snippet}
</FormModal>
