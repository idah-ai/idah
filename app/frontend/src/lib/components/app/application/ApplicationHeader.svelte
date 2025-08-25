<script lang="ts">
	import { page } from "$app/state";

	import Button from "@/components/ui/button/button.svelte";
	import Separator from "@/components/ui/separator/separator.svelte";
	import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

	import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "@lucide/svelte";
	import { useSidebar } from "@/components/ui/sidebar";
	import { getRouteConfigById } from "@/config/routes";

	// Variables
	const sidebar = useSidebar();
	let sidebarIsOpen: boolean = $derived(sidebar.open);
</script>

<header class="flex h-16 shrink-0 items-center gap-2">
	<div class="flex items-center gap-2 px-4">
		<TooltipProvider>
			<Tooltip delayDuration={100}>
				<TooltipTrigger>
					<Button variant="ghost" size="icon" class="-ml-1" onclick={() => sidebar.toggle()}>
						{#if sidebarIsOpen}
							<PanelLeftCloseIcon class="size-4" />
						{:else}
							<PanelLeftOpenIcon class="size-4" />
						{/if}
					</Button>
				</TooltipTrigger>

				<TooltipContent>
					{sidebarIsOpen ? "Collapse Sidebar" : "Expand Sidebar"}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>

		<Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />

		{getRouteConfigById(page.route.id)?.label || page.url.pathname}
	</div>
</header>
