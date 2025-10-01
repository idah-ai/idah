<script lang="ts">
  import Input from "@/components/ui/input/input.svelte";
  import Sidebar from "@/components/ui/sidebar/sidebar.svelte";

  import CategoriesSelection from "./categories-selection.svelte";
  import SidebarHeader from "@/components/ui/sidebar/sidebar-header.svelte";
  import SidebarContent from "@/components/ui/sidebar/sidebar-content.svelte";
  import SidebarGroup from "@/components/ui/sidebar/sidebar-group.svelte";
  import SidebarGroupContent from "@/components/ui/sidebar/sidebar-group-content.svelte";
  import Tabs from "@/components/ui/tabs/tabs.svelte";
  import TabsList from "@/components/ui/tabs/tabs-list.svelte";
  import TabsTrigger from "@/components/ui/tabs/tabs-trigger.svelte";

  import { videoAnnotationTabs, type VideoAnnotationTab } from "./tabs/video-annotation-activity.tabs";

  import type { AnnotationsIndexedDB } from "./indexedDB";
  import type { AnnotationValue } from "$lib/context/AnnotationContext";
  import type {
    CategoryConfiguration,
    PropertyConfiguration,
    TaggingConfiguration,
    VideoAnnotation,
  } from "./VideoAnnotationContext";
  import type { IActivityContext } from "@/plugin/interface/Activity";
  import type { CategoryDefinition } from "@/context/ActivityContext";

  // Props
  let {
    annotationValue,
    onEditValue,
    onSelectAnnotation,
    context,
    mode,
    currentFrame,
    db,
  }: {
    currentFrame: number;
    annotationValue: AnnotationValue;
    onEditValue: (annotationValue: AnnotationValue, mode: string) => void;
    onSelectAnnotation: (annotation: VideoAnnotation) => void;
    context: IActivityContext;
    mode: string;
    db?: AnnotationsIndexedDB;
  } = $props();

  // Variables
  let activeTab = $state<VideoAnnotationTab>("categories");

  let tools = {
    taggings: (context.config.taggings ?? []).reduce(
      (acc: Record<string, TaggingConfiguration[]>, item: TaggingConfiguration) => {
        (acc[item.type] ??= []).push(item);
        return acc;
      },
      {},
    ),

    categories: (context.config.categories ?? []).reduce(
      (acc: Record<string, CategoryConfiguration[]>, item: CategoryConfiguration) => {
        (acc[item.type] ??= []).push(item);
        return acc;
      },
      {},
    ),

    properties: (context.config.properties ?? []).reduce(
      (acc: Record<string, PropertyConfiguration[]>, item: PropertyConfiguration) => {
        (acc[item.type] ??= []).push(item);
        return acc;
      },
      {},
    ),
  };

  // Functions
  function categorySelection(mode: string, category?: string) {
    if (category) {
      onEditValue(
        {
          ...annotationValue,
          category,
        },
        mode,
      );
    } else {
      onEditValue(
        Object.fromEntries(Object.entries(annotationValue).filter(([type, _]) => type == "categories")),
        mode,
      );
    }
  }

  //   For checking activeTab
  function handleTabChange(value: VideoAnnotationTab): void {
    activeTab = value;
  }
</script>

<Sidebar variant="inset" collapsible="none" class="w-sm">
  <SidebarHeader>
    <Tabs bind:value={activeTab}>
      <TabsList class="w-full">
        {#each videoAnnotationTabs as { label, value } (value)}
          <TabsTrigger {value} onclick={() => handleTabChange(value)}>{label}</TabsTrigger>
        {/each}
      </TabsList>
    </Tabs>

    <Input placeholder="Search observable" />
  </SidebarHeader>

  <SidebarContent>
    {#each Object.entries(tools) as [category, categoryList]}
      {#if activeTab === category}
        {#each Object.entries(categoryList) as [type, items]}
          <SidebarGroup>
            <SidebarGroupContent>
              <CategoriesSelection
                {db}
                {type}
                {currentFrame}
                categories={items as CategoryConfiguration[]}
                selected={annotationValue.category}
                {onSelectAnnotation}
                onSelect={(s) => categorySelection(category, s)}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        {/each}
      {/if}
    {/each}
  </SidebarContent>
</Sidebar>
