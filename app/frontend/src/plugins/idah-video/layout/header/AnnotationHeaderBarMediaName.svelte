<script lang="ts">
	import Button from "@/components/ui/button/button.svelte";

	// Props
	interface Props {
		name: string;
	}
	let { name }: Props = $props();
</script>

<Button variant="ghost">
	{name}
</Button>
