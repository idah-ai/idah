<script lang="ts">
	import SidebarTrigger from "$lib/components/ui/sidebar/sidebar-trigger.svelte";
	import Separator from "$lib/components/ui/separator/separator.svelte";
</script>

<header class="flex h-16 shrink-0 items-center gap-2">
	<div class="flex items-center gap-2 px-4">
		<SidebarTrigger class="-ml-1" />

		<Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
	</div>
</header>
