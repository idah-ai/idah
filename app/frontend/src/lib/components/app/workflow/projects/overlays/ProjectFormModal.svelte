<script lang="ts">
	import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
	import ProjectForm from "$lib/components/app/workflow/projects/forms/ProjectForm.svelte";

	import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

	// Props
	interface Props extends FormModalBaseProps {}
	let { action, open = $bindable(), title }: Props = $props();

	// Functions
	function resetForm(): void {}

	async function submit(): Promise<void> {}
</script>

<FormModal {action} {title} onCancel={resetForm} onConfirm={submit} bind:open>
	<ProjectForm></ProjectForm>
</FormModal>
