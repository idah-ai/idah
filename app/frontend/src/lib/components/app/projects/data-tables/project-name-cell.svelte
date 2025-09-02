<script lang="ts">
	import Link from "@/components/ui/text/Link.svelte";

	import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";

	// Props
	interface Props extends DataTableCellBaseProps {}
	let { record: project }: Props = $props();
</script>

<Link href="/projects/{project.id}/tasks" showIcon>
	{project.name}
</Link>
