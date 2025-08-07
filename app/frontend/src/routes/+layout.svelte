<script lang="ts">
	import "../app.css";
	import { ModeWatcher } from "mode-watcher";

	// Props
	let { children } = $props();
</script>

<main class="bg-background relative flex min-h-screen flex-col">
	<!-- <ModeWatcher /> -->
	{@render children?.()}
</main>
