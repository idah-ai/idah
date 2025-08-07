<script lang="ts">
	import SidebarContent from "$lib/components/ui/sidebar/sidebar-content.svelte";
	import SidebarGroupLabel from "$lib/components/ui/sidebar/sidebar-group-label.svelte";
	import SidebarGroup from "$lib/components/ui/sidebar/sidebar-group.svelte";
	import SidebarMenu from "$lib/components/ui/sidebar/sidebar-menu.svelte";
	import SidebarMenuButton from "$lib/components/ui/sidebar/sidebar-menu-button.svelte";
	import SidebarMenuItem from "$lib/components/ui/sidebar/sidebar-menu-item.svelte";

	import { FileVideo2Icon, RocketIcon } from "@lucide/svelte";
</script>

<SidebarContent>
	<SidebarGroup>
		<SidebarGroupLabel>Platform</SidebarGroupLabel>
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton>
					{#snippet child({ props })}
						<a href="/projects" {...props}>
							<RocketIcon class="size-4" />
							Projects
						</a>
						<a href="/video" {...props}>
							<FileVideo2Icon class="size-4" />
							Video Annotation
						</a>
					{/snippet}
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	</SidebarGroup>
</SidebarContent>
