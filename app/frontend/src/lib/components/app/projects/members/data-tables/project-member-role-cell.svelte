<script lang="ts">
	import SingleSelectField from "@/components/app/forms/fields/select/single-select-field.svelte";

	import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";

	// Props
	interface Props extends DataTableCellBaseProps {}
	let { record: projectMember }: Props = $props();

	// Variables
	const resource: string = "Resource::Dataset::Projects";
</script>

<SingleSelectField
	name="{resource}/role"
	class="flex-1"
	placeholder="Select a role"
	choices={[
		{ label: "Annotator", value: "annotator" },
		{ label: "Reviewer", value: "reviewer" },
		{ label: "Project Manager", value: "project_manager" },
		{ label: "Admin", value: "Admin" },
	]}
	required
	clearable
	searchable
	searchPlaceholder="Search a role"
	bind:value={projectMember.role}
/>
