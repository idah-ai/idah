<script lang="ts">
	import FormModal from "$lib/components/app/overlays/modals/FormModal.svelte";
	import ProjectForm from "$lib/components/app/workflow/projects/forms/ProjectForm.svelte";

	import type { FormModalBaseProps } from "$lib/components/app/overlays/modals/FormModal.types";

	// Props
	interface Props extends FormModalBaseProps {}
	let { action, open = $bindable(), title, modalTitle, modalDescription }: Props = $props();
</script>

<FormModal {action} {title} onCancel={() => {}} onConfirm={() => {}} bind:open>
	<ProjectForm></ProjectForm>
</FormModal>
