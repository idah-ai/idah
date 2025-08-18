<script lang="ts">
	import { goto } from "$app/navigation";

	import Button from "@/components/ui/button/button.svelte";
	import { ArrowLeftIcon } from "@lucide/svelte";
</script>

<Button variant="ghost" onclick={() => goto("/")}>
	<ArrowLeftIcon class="size-4" />
	Back
</Button>
