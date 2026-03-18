<script lang="ts">
  import {
    ChevronRight,
    CircleSmallIcon,
    EllipsisVerticalIcon,
    EyeIcon,
    EyeOffIcon,
    LockIcon,
    LockOpenIcon,
    PlusIcon,
    Trash2Icon,
  } from "@lucide/svelte";

  import DropdownMenus from "$lib/components/app/dropdown-menus/dropdown-menus.svelte";
  import Badge from "$lib/components/ui/badge/badge.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "$lib/components/ui/collapsible";
  import { SidebarMenuButton, SidebarMenuItem } from "$lib/components/ui/sidebar";

  import { cn } from "$lib/utils";
  import { humanize } from "$lib/utils/string";

  import type { IConfigValue } from "$idah/context/activity-context";
  import type { CategoryDefinition } from "$idah/context/category-context";

  import PolygonCircleIcon from "$lib/plugin/icon/polygon-circle-icon.svelte";
  import VectorSquareIcon from "$lib/plugin/icon/vector-square-icon.svelte";

  import { IDAH_VIDEO_BOUNDING_BOX, IDAH_VIDEO_POLYGON } from "$lib/plugin/type";
  import { idb_updated_at } from "$lib/plugin/video-annotation-activity/idb-store.svelte";

  import type {
    AnnotationMetadata,
    AnnotationObj,
    AnnotationShape,
    AnnotationValue,
  } from "$idah/context/annotation-context";
  import type { AnnotationsIndexedDB } from "$lib/plugin/video-annotation-activity/indexedDB";
  import type { VideoAnnotation } from "$lib/plugin/video-annotation-activity/video-annotation-context";

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
    onLock,
    onVisibility,
    db,
  }: {
    type: string;
    currentFrame: number;
    categories: IConfigValue[];
    toolMode: boolean;
    selected_category: string | undefined;
    selected_id: string | undefined;
    onSelect: (category?: string) => void;
    onSelectAnnotation: (annotation: VideoAnnotation) => void;
    onDeleteAnnotation: (annotation: VideoAnnotation) => void;
    onLock: (locked: boolean, annotation?: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>) => void;
    onVisibility: (
      hidden: boolean,
      annotation?: AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>,
    ) => void;
    db?: AnnotationsIndexedDB;
  } = $props();

  // Variables
  let manualToggleStates = $state<Record<string, boolean>>({});

  // Automatically expand all categories when categories prop changes, but allow manual toggles
  let openStates = $derived.by(() => {
    const autoExpanded = categories.reduce<Record<string, boolean>>((acc, category) => {
      if (category.id.includes("/")) {
        const parts = category.id.split("/");
        for (let i = 0; i < parts.length - 1; i++) {
          const parentPath = parts.slice(0, i + 1).join("/");
          acc[parentPath] = true;
        }
      }
      // Always set the category itself to true
      acc[category.id] = true;
      return acc;
    }, {});

    // Merge with manual toggles (manual toggles take precedence)
    return { ...autoExpanded, ...manualToggleStates };
  });

  let forceRender = $state(0); // Force re-render trigger
  let categoriesTree = $derived(
    categories.reduce<CategoryDefinition[]>((acc, category_configuration) => {
      return buildTree(acc, category_configuration.id.split("/"), category_configuration);
    }, []),
  );

  // Functions
  function buildTree(acc: CategoryDefinition[], ids: string[], configuration: IConfigValue): CategoryDefinition[] {
    let currentLevel = acc;
    let fullPath = "";

    for (let i = 0; i < ids.length; i++) {
      fullPath = i === 0 ? ids[i] : `${fullPath}/${ids[i]}`;

      // find if node exists at this level
      let existingNode = currentLevel.find((current) => current.id === fullPath);
      if (!existingNode) {
        existingNode = {
          id: fullPath,
          name: humanize(ids[i]),
          requiredNested: i < ids.length - 1,
          // only create nestedCategories if this node will have children
          ...(i < ids.length - 1 ? { nestedCategories: [] } : {}),
          data:
            i < ids.length - 1
              ? ({
                  id: fullPath,
                  label: humanize(ids[i]),
                  color: "#ffff",
                  description: "",
                } as IConfigValue)
              : configuration, // leaf gets real configuration
        };

        currentLevel.push(existingNode);
      }

      // go deeper only if not a leaf
      if (i < ids.length - 1) {
        if (!existingNode.nestedCategories) existingNode.nestedCategories = [];
        currentLevel = existingNode.nestedCategories;
      } else {
        // leaf node: overwrite name, description, requiredNested, data
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
</script>

{#snippet CategoryName(name: string)}
  <div class="truncate whitespace-nowrap">{name}</div>
{/snippet}

{#snippet annotationSelection(annotation: VideoAnnotation, name: string)}
  <SidebarMenuItem class="list-none">
    <SidebarMenuButton
      class={cn("group w-full gap-0 pl-8 hover:cursor-pointer")}
      onclick={() => onSelectAnnotation(annotation)}
    >
      <div class="flex items-center gap-1 text-xs">
        <!-- ANNOTATION ICON -->
        <div class="shrink-0" style="color: var(--color-gray-500)">
          {#if annotation.shape.type === IDAH_VIDEO_BOUNDING_BOX}
            <!-- VECTOR SQUARE ICON -->
            <VectorSquareIcon />
          {:else if annotation.shape.type === IDAH_VIDEO_POLYGON}
            <!-- POLYGON CIRCLE ICON -->
            <PolygonCircleIcon />
          {/if}
        </div>

        {@render CategoryName(name)}
      </div>

      <!-- BUTTON::HIDE & SHOW ANNOTATION -->
      <div class="ml-auto flex items-center gap-0">
        <Button
          variant="ghost"
          size="icon-sm"
          class={cn("text-muted-foreground shrink-0", {
            "opacity-0 group-hover:opacity-100": !annotation.hidden, // show when mouse hover
            "opacity-100": annotation.hidden, // show when annotation is hidden
          })}
          onclick={(e) => {
            e.stopPropagation();
            onVisibility(!annotation.hidden, annotation);
          }}
        >
          {#if annotation.hidden}
            <EyeOffIcon />
          {:else}
            <EyeIcon />
          {/if}
        </Button>

        <!-- BUTTON::LOCK & UNLOCK ANNOTATION -->
        <Button
          variant="ghost"
          size="icon-sm"
          class={cn("text-muted-foreground shrink-0", {
            "opacity-0 group-hover:opacity-100": !annotation.locked, // show when mouse hover
            "opacity-100": annotation.locked, // show when annotation is locked
          })}
          onclick={(e) => {
            e.stopPropagation();
            onLock(!annotation.locked, annotation);
          }}
        >
          {#if annotation.locked}
            <LockIcon />
          {:else}
            <LockOpenIcon />
          {/if}
        </Button>

        <!-- DROPDOWN MENU ACTIONS:: Add more actions here -->
        <DropdownMenus
          align="end"
          menus={{
            actions: {
              items: [
                {
                  label: "Delete",
                  icon: Trash2Icon,
                  action: () => onDeleteAnnotation(annotation),
                },
              ],
            },
          }}
        >
          {#snippet trigger({ props })}
            {@const isOpen = props["data-state"] === "open"}
            <Button
              {...props}
              variant={isOpen ? "secondary" : "ghost"}
              size="icon-sm"
              class={cn("text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100", {
                "opacity-100": isOpen,
              })}
              onclick={(e) => {
                e.stopPropagation();
              }}
            >
              <EllipsisVerticalIcon />
            </Button>
          {/snippet}
        </DropdownMenus>
      </div>
    </SidebarMenuButton>
  </SidebarMenuItem>
{/snippet}

{#snippet showCategoryTitle(category: CategoryDefinition, haveChildren: boolean = false, open: boolean = false)}
  <div
    class={cn("flex w-full items-center gap-1 text-xs group-hover:w-2/4", {
      "p-2": toolMode && selected_id,
    })}
  >
    <Button
      variant="ghost"
      size="icon-sm"
      class={cn("p-0", {
        "opacity-0": !haveChildren || selected_id,
        hidden: toolMode && selected_id,
      })}
      onclick={(e) => {
        e.stopPropagation();
        if (category.nestedCategories || haveChildren) {
          // Toggle the category open state manually
          manualToggleStates[category.id] = !openStates[category.id];
        }
      }}
      disabled={toolMode}
    >
      {@const selected = selected_category == category.id}
      {#if selected && toolMode && !selected_id}
        <PlusIcon class="text-primary" strokeWidth={4} />
      {:else if !category.nestedCategories && toolMode && !selected_id}
        <CircleSmallIcon class="fill-gray-400 stroke-gray-400" />
      {:else}
        {@const parentOpen = category.nestedCategories && toolMode}
        <ChevronRight
          class={cn("", {
            "opacity-0": !haveChildren || category.nestedCategories?.length === 0,
            "rotate-90": open || parentOpen,
            "stroke-blue-300": selected,
            "stroke-gray-500": !selected,
          })}
        />
      {/if}
    </Button>

    {#if type === IDAH_VIDEO_BOUNDING_BOX}
      <VectorSquareIcon color={category.data?.color} class={cn({ hidden: category.requiredNested })} />
    {:else if type === IDAH_VIDEO_POLYGON}>
      <PolygonCircleIcon color={category.data?.color} class={cn({ hidden: category.requiredNested })} />
    {/if}
    {@render CategoryName(category.name)}
  </div>
{/snippet}

{#snippet categorySelection(
  category: CategoryDefinition,
  subCategories: CategoryDefinition[] | undefined,
  onSelect: (category?: string) => void,
  selected: string | undefined,
  parent: string[] = [],
)}
  <Collapsible open={toolMode ? !!category : openStates[category.id] || false}>
    {#key `${forceRender}-${$idb_updated_at}-${type}`}
      {#await haveAnnotationsInCategory(category.id) then hasAnnotations}
        <CollapsibleTrigger
          class={cn(
            "text-secondary-foreground flex w-full items-center justify-between pr-1 text-xs group-hover:w-2/4",
            {
              "bg-secondary border-ring text-secondary-foreground rounded-sm border-1": selected == category.id,
              "hover:bg-primary-foreground hover:dark:bg-accent hover:cursor-pointer hover:rounded-sm":
                !category.requiredNested,
              "hover:bg-accent hover:cursor-pointer hover:rounded-sm": !toolMode,
            },
          )}
          onclick={(e) => {
            // Prevent default toggle behavior
            e.preventDefault();

            // Allow selection if category is not requiredNested,
            // or if it's a parent that exists in the original categories list
            if (categories.find((c) => c.id === category.id)) {
              onSelect(category.id);
            }

            if (category.nestedCategories) {
              // Toggle the category open state manually
              manualToggleStates[category.id] = !openStates[category.id];
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

          {#if db && category}
            {#key $idb_updated_at}
              {#await db.getAllStartingWith("category", category.id) then anns}
                {@const filteredCount = anns.filter(
                  (annotation) =>
                    currentFrame >= annotation.shape.start &&
                    currentFrame <= annotation.shape.end &&
                    annotation.shape.type == type,
                ).length}
                <Badge variant="gray" rounded="full" class="text-[0.625rem]">
                  {filteredCount}
                </Badge>
              {/await}
            {/key}
          {/if}
        </CollapsibleTrigger>
      {/await}
    {/key}

    <CollapsibleContent class="ml-4" hidden={!openStates[category.id]}>
      {#key $idb_updated_at}
        {#if !toolMode && db && category}
          {#await db.getAllIndex("category", category.id) then anns}
            {@const filteredAnns = anns.filter((annotation) => {
              // prettier-ignore ...
              return (
                currentFrame >= annotation.shape.start &&
                currentFrame <= annotation.shape.end &&
                annotation.shape.type == type
              );
            })}
            {#each filteredAnns as annotation, i (annotation.metadata.id)}
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

<div class="flex-col overflow-x-hidden">
  {#each categoriesTree as category (category.id)}
    {@render categorySelection(category, category.nestedCategories, onSelect, selected_category)}
  {/each}
</div>
