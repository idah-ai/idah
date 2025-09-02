<script lang="ts">
	import Badge from "@/components/ui/badge/badge.svelte";
	import Button from "@/components/ui/button/button.svelte";
	import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
	import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

	import type { VideoAnnotation } from "@/components/video-annotation-activity/VideoAnnotationContext";
	import type { CategoriesDefinition, CategoryDefinition } from "@/context/ActivityContext";
    import SidebarMenuSubButton from "../ui/sidebar/sidebar-menu-sub-button.svelte";
    import { cn } from "@/utils";

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

{#snippet annotationSelection(
    annotation: VideoAnnotation,
    name: string,
    annotationCategory?: string,
)}
    <SidebarMenuItem class='delete_hover'>
        <SidebarMenuButton onclick={() => onSelectAnnotation(annotation)}>
            {name}
            {#if selected && selected == annotationCategory}
                <SidebarMenuSubButton class={'hover_deleted'} onclick={() => onSelect()}>
                    <svg class='h-100' viewBox="0 0 12 15" xmlns="http://www.w3.org/2000/svg">
                        <path
                            class="fill-primary"
                            d="M9.33329 5V13.3333H2.66663V5H9.33329ZM8.08329 0H3.91663L3.08329 0.833333H0.166626V2.5H11.8333V0.833333H8.91663L8.08329 0ZM11 3.33333H0.999959V13.3333C0.999959 14.25 1.74996 15 2.66663 15H9.33329C10.25 15 11 14.25 11 13.3333V3.33333Z"
                        />
                    </svg>
                </SidebarMenuSubButton>
            {/if}
        </SidebarMenuButton>
    </SidebarMenuItem>

    <style>
    .delete_hover .hover_deleted {
        display: none;
    }

    .delete_hover:hover .hover_deleted {
        display: inline-block;
    }
</style>

{/snippet}

{#snippet categorySelection(
	category: string,
	subCategories: CategoryDefinition[] | undefined,
	onSelect: (selection?: string) => void,
	selected: string | undefined,
	parent: string[] = [],
)}
	<Collapsible >
		<CollapsibleTrigger onclick={() => onSelect(categoryFullName(category, parent))}>
			{category}
			<Badge variant='secondary'>
				{annotations.filter(
					(annotation) =>
						annotation.value.category?.startsWith(categoryFullName(category, parent)) &&
						currentFrame >= annotation.shape.start &&
						currentFrame <= annotation.shape.end,
				).length}
			</Badge>
		</CollapsibleTrigger>

		<CollapsibleContent style={"margin-left:10px"}>
			{#each annotations.filter((annotation) => annotation.value.category == categoryFullName(category, parent) && currentFrame >= annotation.shape.start && currentFrame <= annotation.shape.end) as annotation, i}
                {@render annotationSelection(annotation, annotation.value.label || `${category}_${i}`, categoryFullName(category, parent))}
			{/each}

            {#if subCategories}
				{#each subCategories as subCategory}
					{@render categorySelection(subCategory.name, subCategory.nestedCategories, onSelect, selected, [
						...parent,
						category,
					])}
				{/each}
			{/if}
		</CollapsibleContent>
	</Collapsible>
{/snippet}

{#each annotations.filter((annotation) => !annotation.value.category && currentFrame >= annotation.shape.start && currentFrame <= annotation.shape.end) as annotation, i}
    {@render annotationSelection(annotation, annotation.value.label || annotation.metadata.id)}
{/each}


{#each Object.entries(categories) as [category, subCategory]}
	{@render categorySelection(category, subCategory, onSelect, selected)}
{/each}
