<script lang="ts">
	import "../app.css";
	import { ModeWatcher } from "mode-watcher";
	import { Toaster } from "@/components/ui/sonner";

	// Props
	let { children } = $props();
</script>

<!-- <main> -->
<ModeWatcher />
<Toaster position="bottom-right" expand={false} />
{@render children?.()}
<!-- </main> -->
