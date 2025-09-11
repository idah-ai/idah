<script lang="ts" module>
	export interface PageBreadcrumbItem {
		label: string;
		href?: string;
	}
</script>

<script lang="ts">
	import {
		Breadcrumb,
		BreadcrumbItem,
		BreadcrumbLink,
		BreadcrumbList,
		BreadcrumbPage,
		BreadcrumbSeparator,
	} from "@/components/ui/breadcrumb";

	// Props
	interface Props {
		items: PageBreadcrumbItem[];
	}
	let { items }: Props = $props();
</script>

<Breadcrumb>
	<BreadcrumbList>
		{#each items as { label, href }, index (index)}
			{@const isLastItem = index === items.length - 1}
			<BreadcrumbItem>
				{#if !href || isLastItem}
					<BreadcrumbPage>{label}</BreadcrumbPage>
				{:else}
					<BreadcrumbLink {href}>{label}</BreadcrumbLink>
				{/if}
			</BreadcrumbItem>

			{#if !isLastItem}
				<BreadcrumbSeparator />
			{/if}
		{/each}
	</BreadcrumbList>
</Breadcrumb>
