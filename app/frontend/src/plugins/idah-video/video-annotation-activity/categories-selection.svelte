<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
  import { cn } from "@/utils";
  import { ChevronRight, CircleSmallIcon, PlusIcon, Trash2Icon } from "@lucide/svelte";
  import { idb_updated_at } from "./idb_store.svelte";
  import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from "@/components/ui/select";
  import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
  import Text from "@/components/ui/text/Text.svelte";

  import type { CategoryConfiguration, VideoAnnotation } from "./VideoAnnotationContext";
  import type { CategoryDefinition } from "@/context/ActivityContext";
  import type { AnnotationsIndexedDB } from "./indexedDB";

  // Props
  let {
    type,
    currentFrame,
    categories,
    selected_category,
    selected_id,
    toolMode,
    onSelect,
    onSelectAnnotation,
    onDeleteAnnotation,
    db,
  }: {
    type: string;
    currentFrame: number;
    categories: CategoryConfiguration[];
    toolMode: boolean;
    selected_category: string | undefined;
    selected_id: string | undefined;
    onSelect: (category?: CategoryDefinition) => void;
    onSelectAnnotation: (annotation: VideoAnnotation) => void;
    onDeleteAnnotation: (annotation: VideoAnnotation) => void;
    db?: AnnotationsIndexedDB;
  } = $props();

  let categoriesTree: CategoryDefinition[] = categories.reduce<CategoryDefinition[]>((acc, category_configuration) => {
    return buildTree(acc, category_configuration.id.split("/"), category_configuration);
  }, []);

  function buildTree(
    acc: CategoryDefinition[],
    ids: string[],
    configuration: CategoryConfiguration,
  ): CategoryDefinition[] {
    console.log({ acc, ids, configuration });

    if (ids.length == 1) {
      acc.push({
        id: configuration.id,
        name: configuration.label,
        description: configuration.description,
        requiredNested: false,
        data: configuration,
      });
    } else {
      const index = acc.findIndex((a) => configuration.id.startsWith(a.id));

      if (index == -1) {
        acc.push({
          id: configuration.id.replace(ids.join("/"), ids.at(0) || ""),
          name: ids[0],
          nestedCategories: buildTree([], ids.slice(1, Infinity), configuration),
          requiredNested: true,
          data: configuration,
        });
      } else {
        acc[index].nestedCategories = buildTree(
          acc[index].nestedCategories || [],
          ids.slice(1, Infinity),
          configuration,
        );
      }
    }
    return acc;
  }

  let uncategorized_promise = $derived.by(async () => {
    $idb_updated_at;
    return ($uncategorizedAnnotations = (await db?.getAllIndex("category")) || []);
  });
</script>

{#snippet annotationSelection(annotation: VideoAnnotation, name: string, annotationCategory?: string)}
  {console.log({ annotation })}
  <SidebarMenuItem class="delete_hover list-none">
    <SidebarMenuButton class="justify-between" onclick={() => onSelectAnnotation(annotation)}>
      <!-- {@render showIcon(name)} -->

        {name}
      </div>

      <!-- {#if selected_category && selected_category == annotationCategory} -->
      <Button
        variant="ghost"
        size="icon"
        class="hover_button"
        onclick={(e) => {
          e.stopPropagation();
          onDeleteAnnotation(annotation);
        }}
      >
        <Trash2Icon color="var(--color-gray-500)" />
      </Button>
      <!-- {/if} -->
    </SidebarMenuButton>
  </SidebarMenuItem>

  <style>
    .item_hover .hover_button {
      display: none;
    }

    .item_hover:hover .hover_button {
      display: inline-flex;
      cursor: pointer;
    }
  </style>
{/snippet}

{#snippet showCategoryTitle(category: CategoryDefinition, haveChildren: boolean = false)}
  <div class="flex items-center gap-2">
    <svg
      class={cn({
        "opacity-0": !haveChildren,
        "rotate-90": false,
      })}
      onclick={(e) => {
        e.stopPropagation();
        if (category.nestedCategories || haveChildren) {
          // Toggle the category open state
          openStates[category.id] = !openStates[category.id];
        }
      }}
      disabled={toolMode}
    >
      <path
        class="stroke-gray-500"
        d="M4 6L8 10L12 6"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>

    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.66667 4.58333H13.3333M6.66667 4.58333C6.66667 5.73393 5.73393 6.66667 4.58333 6.66667M6.66667 4.58333C6.66667 3.43274 5.73393 2.5 4.58333 2.5C3.43274 2.5 2.5 3.43274 2.5 4.58333C2.5 5.73393 3.43274 6.66667 4.58333 6.66667M13.3333 4.58333C13.3333 5.73393 14.2661 6.66667 15.4167 6.66667M13.3333 4.58333C13.3333 3.43274 14.2661 2.5 15.4167 2.5C16.5673 2.5 17.5 3.43274 17.5 4.58333C17.5 5.73393 16.5673 6.66667 15.4167 6.66667M15.4167 6.66667V13.3333M15.4167 13.3333C14.2661 13.3333 13.3333 14.2661 13.3333 15.4167M15.4167 13.3333C16.5673 13.3333 17.5 14.2661 17.5 15.4167C17.5 16.5673 16.5673 17.5 15.4167 17.5C14.2661 17.5 13.3333 16.5673 13.3333 15.4167M13.3333 15.4167H6.66667M6.66667 15.4167C6.66667 16.5673 5.73393 17.5 4.58333 17.5C3.43274 17.5 2.5 16.5673 2.5 15.4167C2.5 14.2661 3.43274 13.3333 4.58333 13.3333M6.66667 15.4167C6.66667 14.2661 5.73393 13.3333 4.58333 13.3333M4.58333 13.3333V6.66667"
        stroke={category.data.color || "var(--color-gray-500)"}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    {category.name}
  </div>
{/snippet}

{#snippet categorySelection(
  category: CategoryDefinition,
  subCategories: CategoryDefinition[] | undefined,
  onSelect: (category?: CategoryDefinition) => void,
  selected: string | undefined,
  parent: string[] = [],
)}
  {console.log({ category })}
  <Collapsible>
    <CollapsibleTrigger
      class={cn("flex w-full items-center justify-between p-2 hover:cursor-pointer")}
      onclick={() => {
        if (!category.requiredNested) onSelect(category.id);
      }}
    >
      {@render showCategoryTitle(category, !!subCategories?.length)}

      {#if db && category && $idb_updated_at}
        {#key $idb_updated_at}
          <Badge variant="secondary">
            {#await db.getAllStartingWith("category", category.id)}
              ...
            {:then anns}
              {anns.filter(
                (annotation) =>
                  currentFrame >= annotation.shape.start &&
                  currentFrame <= annotation.shape.end &&
                  annotation.shape.type == type,
              ).length}
            {/await}
          </Badge>
        {/key}
      {/if}
    </CollapsibleTrigger>

    <CollapsibleContent style={"margin-left:10px"}>
      {#key $idb_updated_at}
        {#if !toolMode && db && category}
          {#await db.getAllIndex("category", category.id)}
            ...
          {:then anns}
            {#each anns.filter((annotation) => currentFrame >= annotation.shape.start && currentFrame <= annotation.shape.end && annotation.shape.type == type) as annotation, i}
              {@render annotationSelection(annotation, `${category.name}_${i}`, category.id)}
            {/each}
          {/await}
        {/if}
      {/key}

      {#if subCategories}
        {#each subCategories as subCategory}
          {@render categorySelection(subCategory, subCategory.nestedCategories, onSelect, selected, [
            ...parent,
            category.id.split("/").slice(parent.length)[0],
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
        return currentFrame >= annotation.shape.start && currentFrame <= annotation.shape.end && annotation.shape.type == type;
      }) as annotation}
        {@render annotationSelection(annotation, annotation.value.label || annotation.metadata.id)}
      {/each}
    {:then annotations}
      {#each annotations.filter((annotation) => {
        return currentFrame >= annotation.shape.start && currentFrame <= annotation.shape.end && annotation.shape.type == type;
      }) as annotation}
        {@render annotationSelection(annotation, annotation.value.label || annotation.metadata.id)}
      {/each}
    {/await}
  {/key}
{/if}

{#each categoriesTree as category}
  {@render categorySelection(category, category.nestedCategories, onSelect, selected)}
{/each}
