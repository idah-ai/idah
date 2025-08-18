<script lang="ts">
	import Badge from "@/components/ui/badge/badge.svelte";
	import Button from "@/components/ui/button/button.svelte";
	import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
	import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

	import type { VideoAnnotation } from "@/components/video-annotation-activity/VideoAnnotationContext";
	import type { CategoriesDefinition, CategoryDefinition } from "@/context/ActivityContext";

	let {
		currentFrame,
		annotations,
		categories,
		selected,
		onSelect,
		onSelectAnnotation,
		required = false,
	}: {
		currentFrame: number;
		annotations: VideoAnnotation[];
		categories: CategoriesDefinition;
		selected: string | undefined;
		onSelect: (selection?: string) => void;
		onSelectAnnotation: (annotation: VideoAnnotation) => void;
		required: boolean;
	} = $props();

	// console.log(getAllCategories(categories))

	function getAllCategories(CategoriesDefinition: CategoriesDefinition): string[] {
		return Object.entries(categories)
			.flatMap(([category, subCategories]) => allSubCategories(category, subCategories))
			.map((c) => c.join("/"));
	}

	function allSubCategories(
		category: string,
		subCategories: CategoryDefinition[] | undefined,
		parent: string[] = [],
	): string[][] {
		if (subCategories) {
			return subCategories.flatMap((c) => allSubCategories(c.name, c.nestedCategories, [...parent, category]));
		} else {
			return [[...parent, category]];
		}
	}

	function categoryFullName(category: string, parent: string[]) {
		return [...parent, category].join("/");
	}
</script>

{#snippet categorySelection(
	category: string,
	subCategories: CategoryDefinition[] | undefined,
	onSelect: (selection?: string) => void,
	selected: string | undefined,
	parent: string[] = [],
)}
	<!-- {required ? (selected ? (selected.startsWith(categoryFullName(category, parent)) ? 'bg-green-300': 'bg-green-200') : 'bg-red-200') : selected?.startsWith(categoryFullName(category, parent)) ? 'bg-green-200': 'light'} -->
	<Collapsible open={selected?.startsWith(categoryFullName(category, parent))}>
		<CollapsibleTrigger>
			{category}
			<Badge>
				{annotations.filter(
					(annotation) =>
						annotation.value.category?.startsWith(categoryFullName(category, parent)) &&
						currentFrame >= annotation.shape.start &&
						currentFrame <= annotation.shape.end,
				).length}
			</Badge>
		</CollapsibleTrigger>
		{#if selected == categoryFullName(category, parent)}
			<Button onclick={() => onSelect()}>-</Button>
		{/if}
		{#if selected != categoryFullName(category, parent)}
			<Button onclick={() => onSelect(categoryFullName(category, parent))}>+</Button>
		{/if}

		<CollapsibleContent style={"margin-left:10px"}>
			{#if subCategories}
				{#each subCategories as subCategory}
					{@render categorySelection(subCategory.name, subCategory.nestedCategories, onSelect, selected, [
						...parent,
						category,
					])}
				{/each}
			{/if}

			{#each annotations.filter((annotation) => annotation.value.category == categoryFullName(category, parent) && currentFrame >= annotation.shape.start && currentFrame <= annotation.shape.end) as annotation, i}
				<SidebarMenuItem>
					<SidebarMenuButton onclick={() => onSelectAnnotation(annotation)}>
						{annotation.value.label || `${category}_${i}`}
					</SidebarMenuButton>
				</SidebarMenuItem>
			{/each}
		</CollapsibleContent>
	</Collapsible>
{/snippet}

{#each Object.entries(categories) as [category, subCategory]}
	{@render categorySelection(category, subCategory, onSelect, selected)}
{/each}
