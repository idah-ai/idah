<script lang="ts">
	import '../app.css';
	let { children } = $props();
	import { ModeWatcher } from "mode-watcher";
</script>


<!-- <main> -->
	 <ModeWatcher />
	{@render children?.()}
<!-- </main> -->
