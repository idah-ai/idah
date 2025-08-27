<script lang="ts">
	import FormModal from "$lib/components/app/overlays/modals/FormModal.svelte";
	import ProjectForm from "$lib/components/app/workflow/projects/forms/ProjectForm.svelte";

	import type { FormModalBaseProps } from "$lib/components/app/overlays/modals/FormModal.types";

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
