<script lang="ts">
	import Badge from "@/components/ui/badge/badge.svelte";
	import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
	import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

    import type { CategoryConfiguration, VideoAnnotation } from "./VideoAnnotationContext";
    import SidebarMenuSubButton from "@/components/ui/sidebar/sidebar-menu-sub-button.svelte";
    import type {CategoryDefinition } from "@/context/ActivityContext";

	let {
		currentFrame,
		annotations,
		categories,
		selected,
		onSelect,
		onSelectAnnotation,
	}: {
		currentFrame: number;
		annotations: VideoAnnotation[];
		categories: CategoryConfiguration[];
		selected: string | undefined;
		onSelect: (selection?: string) => void;
		onSelectAnnotation: (annotation: VideoAnnotation) => void;
	} = $props();

    function buildAcc(acc :CategoryDefinition[], ids:string[], configuration:CategoryConfiguration):CategoryDefinition[] {
        if (ids.length == 1) {
            acc.push({
                id: configuration.id,
                name: configuration.label,
                description: configuration.description,
            })
        } else {
            const index = acc.findIndex(a => configuration.id )

            if (index == -1) {
                acc.push({
                    id: ids.length ? ids[0] : configuration.id.replace(ids.join('/'),''),
                    name: ids.length ? ids[0] : configuration.id.replace(ids.join('/'),''),
                    nestedCategories: buildAcc([], ids.slice(1, Infinity), configuration)
                })
            } else {
                acc[index].nestedCategories = buildAcc(acc[index].nestedCategories || [], ids.slice(1, Infinity), configuration)
            }
        }
        return acc
    }

    let categoriesTree:CategoryDefinition[] = categories.reduce<CategoryDefinition[]>((acc, category_configuration) => {
            return buildAcc(acc, category_configuration.id.split('/'), category_configuration)
        }, [])


	function categoryFullName(category: string, parent: string[]) {
		return [...parent, category].join("/");
	}

    $effect(() => console.log({annotations}))
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

{#each categoriesTree as category}
	{@render categorySelection(category.id, category.nestedCategories, onSelect, selected)}
{/each}
