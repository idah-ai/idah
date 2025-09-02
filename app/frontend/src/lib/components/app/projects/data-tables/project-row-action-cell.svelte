<script lang="ts">
	import ProjectDropdownMenu from "@/components/app/projects/dropdowns/project-dropdown-menu.svelte";

	// Props
	interface Props {
		record: Record<string, unknown>;
	}
	let { record: project }: Props = $props();
</script>

<ProjectDropdownMenu />
