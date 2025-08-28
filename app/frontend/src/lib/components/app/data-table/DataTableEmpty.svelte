<script lang="ts">
	import Button from "@/components/ui/button/button.svelte";
	import ResponseBlock from "@/components/app/blocks/ResponseBlock.svelte";

	import { InboxIcon, PlusIcon } from "@lucide/svelte";

	// Props
	interface Props {
		dataTableName: string;
	}
	let { dataTableName }: Props = $props();
</script>

<ResponseBlock title="No {dataTableName}" description="Please add a {dataTableName} to get started" icon={InboxIcon}>
	{#snippet actions()}
		<Button class="capitalize">
			<PlusIcon class="size-4" />
			Add {dataTableName}
		</Button>
	{/snippet}
</ResponseBlock>
