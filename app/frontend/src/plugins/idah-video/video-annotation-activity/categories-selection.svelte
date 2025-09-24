<script lang="ts">
	import Badge from "@/components/ui/badge/badge.svelte";
	import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
	import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

    import type { CategoryConfiguration, VideoAnnotation } from "./VideoAnnotationContext";
    import SidebarMenuSubButton from "@/components/ui/sidebar/sidebar-menu-sub-button.svelte";
    import type {CategoryDefinition } from "@/context/ActivityContext";
    import type { AnnotationsIndexedDB } from "./indexedDB";
    import { annotationsCategory, idb_updated_at, uncategorizedAnnotations } from "./idb_store.svelte";
    import { set } from "date-fns";

	let {
        type,
		currentFrame,
		categories,
		selected,
		onSelect,
		onSelectAnnotation,
        db,
	}: {
        type: string,
		currentFrame: number;
		categories: CategoryConfiguration[];
		selected: string | undefined;
		onSelect: (selection?: string) => void;
		onSelectAnnotation: (annotation: VideoAnnotation) => void,
        db?: AnnotationsIndexedDB
	} = $props();

    let categoriesTree:CategoryDefinition[] = categories.reduce<CategoryDefinition[]>((acc, category_configuration) => {
            return buildTree(acc, category_configuration.id.split('/'), category_configuration)
        }, [])

    function buildTree(acc :CategoryDefinition[], ids:string[], configuration:CategoryConfiguration):CategoryDefinition[] {
        if (ids.length == 1) {
            acc.push({
                id: configuration.id,
                name: configuration.label,
                description: configuration.description,
                requiredNested: false
            })
        } else {
            const index = acc.findIndex(a => configuration.id.startsWith(a.id) )

            if (index == -1) {
                acc.push({
                    id: configuration.id.replace(
                        ids.join('/'),
                        ids.at(0) || ''
                    ),
                    name: ids[0],
                    nestedCategories: buildTree([], ids.slice(1, Infinity), configuration),
                    requiredNested: true
                })
            } else {
                acc[index].nestedCategories = buildTree(acc[index].nestedCategories || [], ids.slice(1, Infinity), configuration)
            }
        }
        return acc
    }

    let uncategorized_promise = $derived.by(async () => {
        $idb_updated_at
        return $uncategorizedAnnotations = (await db?.getAllIndex('category')) || []
    })
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
	category: CategoryDefinition,
	subCategories: CategoryDefinition[] | undefined,
	onSelect: (selection?: string) => void,
	selected: string | undefined,
	parent: string[] = [],
)}

	<Collapsible>
		<CollapsibleTrigger onclick={() => {if(!category.requiredNested) onSelect(category.id)}}>
			{category.name}
                {#if db && category && $idb_updated_at}
                    {#key $idb_updated_at}
            			<Badge variant='secondary'>
                        {#await db.getAllStartingWith('category', category.id)}
                            ...
                        {:then anns}
                            {anns.filter(
                                (annotation) =>
                                    currentFrame >= annotation.shape.start &&
                                    currentFrame <= annotation.shape.end &&
                                    annotation.shape.type == type
                            ).length}
                        {/await}
			</Badge>
                   {/key}
                {/if}
		</CollapsibleTrigger>

		<CollapsibleContent style={"margin-left:10px"}>
            {#key $idb_updated_at}
                {#if db && category}
                    {#await db.getAllIndex('category', category.id)}
                        ...
                    {:then anns}
                        {#each anns.filter(
                                (annotation) =>
                                    currentFrame >= annotation.shape.start &&
                                    currentFrame <= annotation.shape.end &&
                                    annotation.shape.type == type
                            ) as annotation, i}
                            {@render annotationSelection(annotation, annotation.value.label || `${category.name}_${i}`, category.id)}
                        {/each}
                    {/await}
                {/if}
            {/key}

            {#if subCategories}
				{#each subCategories as subCategory}
					{@render categorySelection(subCategory, subCategory.nestedCategories, onSelect, selected, [
						...parent,
						category.id.split('/').slice(parent.length)[0]
					])}
				{/each}
			{/if}
		</CollapsibleContent>
	</Collapsible>
{/snippet}


{#if db}
    {#key [db, $idb_updated_at]}
        {#await uncategorized_promise}
            {#each $uncategorizedAnnotations.filter((annotation) => {
                return currentFrame >= annotation.shape.start &&
                currentFrame <= annotation.shape.end &&
                annotation.shape.type == type
            })as annotation}
                {@render annotationSelection(annotation, annotation.value.label || annotation.metadata.id)}
            {/each}
        {:then annotations}
            {#each annotations.filter((annotation) => {
                return currentFrame >= annotation.shape.start &&
                currentFrame <= annotation.shape.end &&
                annotation.shape.type == type
            })as annotation}
                {@render annotationSelection(annotation, annotation.value.label || annotation.metadata.id)}
            {/each}
        {/await}
    {/key}
    <!-- {#key [db, $idb_updated_at]}
        {#await db.getAllIndex('category')}
            loading...
        {:then uncategorizedAnnotations}
            {#each uncategorizedAnnotations.filter((annotation) => {
                return currentFrame >= annotation.shape.start &&
                currentFrame <= annotation.shape.end &&
                annotation.shape.type == type
            })as annotation}
                {@render annotationSelection(annotation, annotation.value.label || annotation.metadata.id)}
            {/each}
        {/await}

    {/key} -->
{/if}

{#each categoriesTree as category}
    {@render categorySelection(category, category.nestedCategories, onSelect, selected)}
{/each}
