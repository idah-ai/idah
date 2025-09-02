<script lang="ts" module>
	import { type Icon as IconType } from "@lucide/svelte";
	import type { Snippet } from "svelte";

	export interface ApplicationSidebarMenuItemProps {
		label: string;
		href?: string;
		icon?: typeof IconType;
		onClick?: () => void;
	}
</script>

<script lang="ts">
	import { page } from "$app/state";

	import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
	import { cn } from "@/utils";

	// Props
	interface Props extends ApplicationSidebarMenuItemProps {
		class?: string | null;
		children?: Snippet;
	}
	let { label, href = "#", icon: Icon, onClick = () => {}, class: className, children }: Props = $props();
</script>

<SidebarMenu>
	<SidebarMenuItem class={cn("", className)}>
		<SidebarMenuButton
			isActive={page.url.pathname.includes(href || "#")}
			onclick={() => {
				onClick?.();
			}}
		>
			{#snippet child({ props })}
				{#if children}
					{@render children?.()}
				{:else}
					<a {href} {...props}>
						{#if Icon}
							<Icon class="size-4" />
						{/if}

						{label}
					</a>
				{/if}
			{/snippet}
		</SidebarMenuButton>
	</SidebarMenuItem>
</SidebarMenu>
