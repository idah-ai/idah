<script lang="ts">
	import ApplicationSidebarMenuItem from "@/components/app/application/sidebar/ApplicationSidebarMenuItem.svelte";
	import { SidebarContent, SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";
	import { BellIcon, LifeBuoyIcon, RocketIcon } from "@lucide/svelte";

	import type { ApplicationSidebarMenuItemProps } from "@/components/app/application/sidebar/ApplicationSidebarMenuItem.svelte";

	// Variables
	let primaryMenus: ApplicationSidebarMenuItemProps[] = $state([
		{
			label: "Projects",
			href: "/projects",
			icon: RocketIcon,
		},
	]);

	let secondaryMenus: ApplicationSidebarMenuItemProps[] = $state([
		{
			label: "Notifications",
			href: "/notifications",
			icon: BellIcon,
		},
		{
			label: "Support",
			href: "/supports",
			icon: LifeBuoyIcon,
		},
	]);
</script>

<SidebarContent>
	<SidebarGroup>
		<SidebarGroupContent>
			{#each primaryMenus as item}
				<ApplicationSidebarMenuItem {...item} />
			{/each}
		</SidebarGroupContent>
	</SidebarGroup>

	<SidebarGroup class="mt-auto">
		<SidebarGroupContent>
			{#each secondaryMenus as item}
				<ApplicationSidebarMenuItem {...item} />
			{/each}
		</SidebarGroupContent>
	</SidebarGroup>
</SidebarContent>
