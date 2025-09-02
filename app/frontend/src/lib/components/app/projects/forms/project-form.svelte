<script lang="ts">
	import Form from "@/components/app/forms/form.svelte";
	import InputField from "@/components/app/forms/fields/input/input-field.svelte";
	import TextareaField from "@/components/app/forms/fields/input/textarea-field.svelte";

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
