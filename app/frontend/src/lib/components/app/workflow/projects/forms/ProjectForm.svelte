<script lang="ts">
	import Form from "$lib/components/app/forms/Form.svelte";
	import InputField from "$lib/components/app/forms/fields/input/InputField.svelte";
	import TextareaField from "$lib/components/app/forms/fields/input/TextareaField.svelte";

	// Variables
	let resource = "project";
	let project = $state({
		name: "",
		description: "",
	});
</script>

<Form>
	<!-- PROJECT::NAME -->
	<InputField name="{resource}/name" label="Name" placeholder="Enter project name" bind:value={project.name} />

	<!-- PROJECT::DESCRIPTION -->
	<TextareaField
		name="{resource}/description"
		label="Description"
		placeholder="Enter project description"
		bind:value={project.description}
	/>
</Form>
