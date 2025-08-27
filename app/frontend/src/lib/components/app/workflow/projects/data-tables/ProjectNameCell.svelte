<script lang="ts">
	import type { DataTableCellBaseProps } from "@/components/app/data-table/DataTable.types";
	import Link from "@/components/ui/text/Link.svelte";

	// Props
	interface Props extends DataTableCellBaseProps {}
	let { record: project }: Props = $props();
</script>

<Link href="/projects/{project.id}/tasks" showIcon>
	{project.name}
</Link>
