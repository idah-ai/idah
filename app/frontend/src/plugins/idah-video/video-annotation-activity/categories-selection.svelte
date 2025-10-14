<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
  import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
  import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
  import Text from "@/components/ui/text/Text.svelte";
  import { cn } from "@/utils";
  import { humanize } from "@/utils/string";
  import { ChevronRight, CircleSmallIcon, PlusIcon, Trash2Icon } from "@lucide/svelte";
  import { idb_updated_at } from "./idb_store.svelte";

  import type { CategoryDefinition } from "@/context/ActivityContext";
  import type { AnnotationsIndexedDB } from "./indexedDB";
  import type { CategoryConfiguration, VideoAnnotation } from "./VideoAnnotationContext";

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

  // Variables
  let openStates = $state<Record<string, boolean>>(
    categories.reduce<Record<string, boolean>>((acc, category) => {
      if (category.id.includes("/")) {
        const parts = category.id.split("/");
        for (let i = 0; i < parts.length - 1; i++) {
          const parentPath = parts.slice(0, i + 1).join("/");
          acc[parentPath] = true;
        }
      }
      return acc;
    }, {}),
  );
  let forceRender = $state(0); // Force re-render trigger

  let categoriesTree: CategoryDefinition[] = categories.reduce<CategoryDefinition[]>((acc, category_configuration) => {
    return buildTree(acc, category_configuration.id.split("/"), category_configuration);
  }, []);

  // Functions
  function buildTree(
    acc: CategoryDefinition[],
    ids: string[],
    configuration: CategoryConfiguration,
  ): CategoryDefinition[] {
    let currentLevel = acc;
    let fullPath = "";

    for (let i = 0; i < ids.length; i++) {
      fullPath = i === 0 ? ids[i] : `${fullPath}/${ids[i]}`;

      // find if node exists at this level
      let existingNode = currentLevel.find((n) => n.id === fullPath);
      if (!existingNode) {
        existingNode = {
          id: fullPath,
          name: humanize(ids[i]),
          requiredNested: i < ids.length - 1,
          nestedCategories: [],
          data: { id: fullPath, label: humanize(ids[i]), color: "#ffff", description: "" } as CategoryConfiguration,
        };
        currentLevel.push(existingNode);
      }

      // go deeper
      if (i < ids.length - 1) {
        if (!existingNode.nestedCategories) existingNode.nestedCategories = [];
        currentLevel = existingNode.nestedCategories;
      } else {
        // leaf node
        existingNode.name = humanize(configuration.label);
        existingNode.description = configuration.description;
        existingNode.requiredNested = false;
        existingNode.data = configuration;
      }
    }

    return acc;
  }

  async function haveAnnotationsInCategory(categoryId: string): Promise<boolean> {
    if (!db || !categoryId) return false;
    const allAnnotations = await db.getAllStartingWith("category", categoryId);
    const filterAnnotations = allAnnotations.filter((annotation) => {
      return (
        currentFrame >= annotation.shape.start && currentFrame <= annotation.shape.end && annotation.shape.type == type
      );
    });

    return filterAnnotations.length > 0;
  }

  function findCategory(categories: CategoryDefinition[], category: string): CategoryDefinition | undefined {
    const found = categories.find((c) => category.startsWith(c.id));

    if (!found) return;

    if (found.id != category) {
      if (found.nestedCategories) return findCategory(found.nestedCategories, category);
      else return;
    }

    return found;
  }
</script>

{#snippet annotationSelection(annotation: VideoAnnotation, name: string)}
  <SidebarMenuItem class="item_hover list-none p-1">
    <SidebarMenuButton
      class={cn("ml-5 w-full justify-between px-5 hover:cursor-pointer")}
      onclick={() => onSelectAnnotation(annotation)}
    >
      <div class="flex gap-2">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M6.66667 4.58333H13.3333M6.66667 4.58333C6.66667 5.73393 5.73393 6.66667 4.58333 6.66667M6.66667 4.58333C6.66667 3.43274 5.73393 2.5 4.58333 2.5C3.43274 2.5 2.5 3.43274 2.5 4.58333C2.5 5.73393 3.43274 6.66667 4.58333 6.66667M13.3333 4.58333C13.3333 5.73393 14.2661 6.66667 15.4167 6.66667M13.3333 4.58333C13.3333 3.43274 14.2661 2.5 15.4167 2.5C16.5673 2.5 17.5 3.43274 17.5 4.58333C17.5 5.73393 16.5673 6.66667 15.4167 6.66667M15.4167 6.66667V13.3333M15.4167 13.3333C14.2661 13.3333 13.3333 14.2661 13.3333 15.4167M15.4167 13.3333C16.5673 13.3333 17.5 14.2661 17.5 15.4167C17.5 16.5673 16.5673 17.5 15.4167 17.5C14.2661 17.5 13.3333 16.5673 13.3333 15.4167M13.3333 15.4167H6.66667M6.66667 15.4167C6.66667 16.5673 5.73393 17.5 4.58333 17.5C3.43274 17.5 2.5 16.5673 2.5 15.4167C2.5 14.2661 3.43274 13.3333 4.58333 13.3333M6.66667 15.4167C6.66667 14.2661 5.73393 13.3333 4.58333 13.3333M4.58333 13.3333V6.66667"
            stroke="var(--color-gray-500)"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>

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

{#snippet showCategoryTitle(category: CategoryDefinition, haveChildren: boolean = false, open: boolean = false)}
  <div
    class={cn("flex items-center gap-2 text-gray-700", {
      // "p-2": !haveChildren && !toolMode,
    })}
  >
    <Button
      variant="ghost"
      class={cn("p-0 hover:cursor-pointer", {
        "opacity-0": (!haveChildren && !toolMode) || selected_id,
        hidden: toolMode && selected_id,
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
      {@const selectedCategory = selected_category == category.id}

      {#if selectedCategory && toolMode && !selected_id}
        <PlusIcon class="text-primary size-4 " strokeWidth={4}></PlusIcon>
      {:else if !category.nestedCategories && toolMode && !selected_id}
        <CircleSmallIcon class="fill-gray-400 stroke-gray-400"></CircleSmallIcon>
      {:else}
        {@const parentOpen = category.nestedCategories && toolMode}
        <ChevronRight
          class={cn("size-4", {
            "opacity-0": !haveChildren || category.nestedCategories?.length === 0,
            "rotate-90": open || parentOpen,
            "stroke-blue-300": selectedCategory,
            "stroke-gray-500": !selectedCategory,
          })}
        ></ChevronRight>
      {/if}
    </Button>

    <svg
      class={cn("", {
        hidden: category.requiredNested,
      })}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
    >
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
  <Collapsible open={toolMode ? !!category : openStates[category.id] || false}>
    {#key forceRender}
      {#await haveAnnotationsInCategory(category.id) then hasAnnotations}
        <CollapsibleTrigger
          class={cn("flex w-full items-center justify-between", {
            "bg-primary-foreground border-1 rounded-sm border-blue-300": selected == category.id,
            "hover:bg-primary-foreground hover:cursor-pointer hover:rounded-sm": !category.requiredNested,
            "hover:bg-accent hover:cursor-pointer hover:rounded-sm": category.requiredNested && !toolMode,
          })}
          onclick={(e) => {
            // Prevent default toggle behavior
            e.preventDefault();

            // Allow selection if category is not requiredNested, or if it's a parent that exists in the original categories list
            if (categories.find((c) => c.id === category.id)) {
              onSelect(category);
            }

            if (category.nestedCategories) {
              // Toggle the category open state
              openStates[category.id] = !openStates[category.id];
            }
            // Force re-render of annotation counts
            forceRender++;
          }}
        >
          {@render showCategoryTitle(
            category,
            !!category.nestedCategories || hasAnnotations,
            openStates[category.id] || false,
          )}

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
      {/await}
    {/key}

    <CollapsibleContent class="ml-5" hidden={!openStates[category.id]}>
      {#key $idb_updated_at}
        {#if !toolMode && db && category}
          {#await db.getAllIndex("category", category.id)}
            ...
          {:then anns}
            {#each anns.filter((annotation) => currentFrame >= annotation.shape.start && currentFrame <= annotation.shape.end && annotation.shape.type == type) as annotation, i (annotation.metadata.id)}
              {@render annotationSelection(annotation, `${category.name}_${i}`)}
            {/each}
          {/await}
        {/if}
      {/key}

      {#if subCategories}
        {#each subCategories as subCategory (subCategory.id)}
          {@render categorySelection(subCategory, subCategory.nestedCategories, onSelect, selected, [
            ...parent,
            category.id.split("/").slice(parent.length)[0],
          ])}
          <!-- pass managed open state for children -->
        {/each}
      {/if}
    </CollapsibleContent>
  </Collapsible>
{/snippet}

<div class="flex-col">
  {#if selected_id && selected_category}
    {@const foundCategory = findCategory(categoriesTree, selected_category)}
    {#if categoriesTree && foundCategory}
      <div class="flex pb-1">
        <Text class="text-gray-700" weight="medium" size="sm">Category</Text>
      </div>

      <Select
        type="single"
        onValueChange={(category_id) => {
          onSelect(findCategory(categoriesTree, category_id));
        }}
      >
        <SelectTrigger class="w-full">
          {@render showCategoryTitle(foundCategory, false, false)}
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {#each categories as category (category.id)}
              <SelectItem value={category.id} label={category.label}>
                {category.label}
              </SelectItem>
            {/each}
          </SelectGroup>
        </SelectContent>
      </Select>
    {/if}
  {:else}
    <div class="flex gap-2 py-2">
      <Text class="text-gray-500" weight="semibold">Categories</Text>

      {#key $idb_updated_at}
        <Badge class={cn({ "bg-gray-300": !!selected_category })} variant="secondary">
          {#await db?.getAllIndex("category")}
            ...
          {:then anns}
            {anns?.filter(
              (annotation) =>
                currentFrame >= annotation.shape.start &&
                currentFrame <= annotation.shape.end &&
                annotation.shape.type == type,
            ).length}
          {/await}
        </Badge>
      {/key}
    </div>

    {#each categoriesTree as category (category.id)}
      {@render categorySelection(category, category.nestedCategories, onSelect, selected_category)}
    {/each}
  {/if}
</div>
