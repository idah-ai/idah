<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
  import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

  import type { CategoryConfiguration, VideoAnnotation } from "./VideoAnnotationContext";
  import SidebarMenuSubButton from "@/components/ui/sidebar/sidebar-menu-sub-button.svelte";
  import type { CategoryDefinition } from "@/context/ActivityContext";
  import type { AnnotationsIndexedDB } from "./indexedDB";
  import { annotationsCategory, idb_updated_at, uncategorizedAnnotations } from "./idb_store.svelte";
  import { set } from "date-fns";
  import { cn } from "@/utils";

  let {
    type,
    currentFrame,
    categories,
    selected,
    onSelect,
    onSelectAnnotation,
    db,
  }: {
    type: string;
    currentFrame: number;
    categories: CategoryConfiguration[];
    selected: string | undefined;
    onSelect: (selection?: string) => void;
    onSelectAnnotation: (annotation: VideoAnnotation) => void;
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
    if (ids.length == 1) {
      acc.push({
        id: configuration.id,
        name: configuration.label,
        description: configuration.description,
        requiredNested: false,
      });
    } else {
      const index = acc.findIndex((a) => configuration.id.startsWith(a.id));

      if (index == -1) {
        acc.push({
          id: configuration.id.replace(ids.join("/"), ids.at(0) || ""),
          name: ids[0],
          nestedCategories: buildTree([], ids.slice(1, Infinity), configuration),
          requiredNested: true,
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
  <SidebarMenuItem class="delete_hover list-none">
    <SidebarMenuButton class="justify-between" onclick={() => onSelectAnnotation(annotation)}>
      {@render showIcon(name)}

      {#if selected && selected == annotationCategory}
        <SidebarMenuSubButton class={"hover_deleted"} onclick={() => onSelect()}>
          <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3.66667 7.33344V4.66677C3.66584 3.84013 3.97219 3.04268 4.52625 2.42921C5.08031 1.81575 5.84255 1.43004 6.665 1.34696C7.48745 1.26389 8.31143 1.48937 8.97698 1.97964C9.64253 2.46992 10.1022 3.19 10.2667 4.0001M2.33333 7.33344H11.6667C12.403 7.33344 13 7.93039 13 8.66677V13.3334C13 14.0698 12.403 14.6668 11.6667 14.6668H2.33333C1.59695 14.6668 1 14.0698 1 13.3334V8.66677C1 7.93039 1.59695 7.33344 2.33333 7.33344Z"
              class="stroke-gray-500"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>

          <svg class="h-100" viewBox="0 0 12 15" xmlns="http://www.w3.org/2000/svg">
            <path
              class="fill-gray-500"
              d="M9.33329 5V13.3333H2.66663V5H9.33329ZM8.08329 0H3.91663L3.08329 0.833333H0.166626V2.5H11.8333V0.833333H8.91663L8.08329 0ZM11 3.33333H0.999959V13.3333C0.999959 14.25 1.74996 15 2.66663 15H9.33329C10.25 15 11 14.25 11 13.3333V3.33333Z"
            />
          </svg>

          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M1.3335 7.99992C1.3335 7.99992 3.3335 3.33325 8.00016 3.33325C12.6668 3.33325 14.6668 7.99992 14.6668 7.99992C14.6668 7.99992 12.6668 12.6666 8.00016 12.6666C3.3335 12.6666 1.3335 7.99992 1.3335 7.99992Z"
              class="stroke-gray-500"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z"
              class="stroke-gray-500"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
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
      display: inline-flex;
      align-items: center;
      cursor: pointer;
    }
  </style>
{/snippet}

{#snippet showIcon(categoryName: string)}
  <div class="flex items-center gap-2">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.66667 4.58333H13.3333M6.66667 4.58333C6.66667 5.73393 5.73393 6.66667 4.58333 6.66667M6.66667 4.58333C6.66667 3.43274 5.73393 2.5 4.58333 2.5C3.43274 2.5 2.5 3.43274 2.5 4.58333C2.5 5.73393 3.43274 6.66667 4.58333 6.66667M13.3333 4.58333C13.3333 5.73393 14.2661 6.66667 15.4167 6.66667M13.3333 4.58333C13.3333 3.43274 14.2661 2.5 15.4167 2.5C16.5673 2.5 17.5 3.43274 17.5 4.58333C17.5 5.73393 16.5673 6.66667 15.4167 6.66667M15.4167 6.66667V13.3333M15.4167 13.3333C14.2661 13.3333 13.3333 14.2661 13.3333 15.4167M15.4167 13.3333C16.5673 13.3333 17.5 14.2661 17.5 15.4167C17.5 16.5673 16.5673 17.5 15.4167 17.5C14.2661 17.5 13.3333 16.5673 13.3333 15.4167M13.3333 15.4167H6.66667M6.66667 15.4167C6.66667 16.5673 5.73393 17.5 4.58333 17.5C3.43274 17.5 2.5 16.5673 2.5 15.4167C2.5 14.2661 3.43274 13.3333 4.58333 13.3333M6.66667 15.4167C6.66667 14.2661 5.73393 13.3333 4.58333 13.3333M4.58333 13.3333V6.66667"
        stroke="#9CA3AF"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    {categoryName}
  </div>
{/snippet}

{#snippet categorySelection(
  category: CategoryDefinition,
  subCategories: CategoryDefinition[] | undefined,
  onSelect: (selection?: string) => void,
  selected: string | undefined,
  parent: string[] = [],
)}
  <Collapsible>
    <CollapsibleTrigger
      class={cn("flex w-full items-center justify-between p-2 hover:cursor-pointer")}
      onclick={() => {
        if (!category.requiredNested) onSelect(category.id);
      }}
    >
      {@render showIcon(category.name)}
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
        {#if db && category}
          {#await db.getAllIndex("category", category.id)}
            ...
          {:then anns}
            {#each anns.filter((annotation) => currentFrame >= annotation.shape.start && currentFrame <= annotation.shape.end && annotation.shape.type == type) as annotation, i}
              {@render annotationSelection(annotation, annotation.value.label || `${category.name}_${i}`, category.id)}
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
