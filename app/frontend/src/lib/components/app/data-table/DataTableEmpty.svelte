<script lang="ts">
	import Button from "@/components/ui/button/button.svelte";
	import Text from "@/components/ui/text/Text.svelte";

	import { InboxIcon, PlusIcon } from "@lucide/svelte";

	// Props
	interface Props {
		dataTableName: string;
	}
	let { dataTableName }: Props = $props();
</script>

<div class="flex flex-col items-center gap-4">
	<Button variant="outline" size="icon">
		<InboxIcon class="size-4" />
	</Button>

	<div class="flex flex-col items-center gap-1">
		<Text weight="semibold" class="capitalize">No {dataTableName} added</Text>
		<Text size="sm" class="text-muted-foreground">Please add a {dataTableName} to get started</Text>
	</div>

	<Button class="capitalize">
		<PlusIcon class="size-4" />
		Add {dataTableName}
	</Button>
</div>
