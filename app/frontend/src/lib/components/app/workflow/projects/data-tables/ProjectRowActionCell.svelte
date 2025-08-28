<script lang="ts">
	import ProjectDropdownMenu from "@/components/app/workflow/projects/dropdowns/ProjectDropdownMenu.svelte";

	// Props
	interface Props {
		record: Record<string, unknown>;
	}
	let { record: project }: Props = $props();
</script>

<ProjectDropdownMenu />
