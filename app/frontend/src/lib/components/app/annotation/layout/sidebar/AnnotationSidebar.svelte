<script lang="ts">
  import AnnotationSidebarCollapsibleCategories from "@/components/app/annotation/layout/sidebar/AnnotationSidebarCollapsibleCategories.svelte";
  import Input from "@/components/ui/input/input.svelte";
  import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenuButton,
    SidebarMenu,
    SidebarMenuItem,
  } from "@/components/ui/sidebar";

  import type { ToolInfo } from "@/context/ActivityContext";
  import type { AnnotationValue } from "@/context/AnnotationContext";
  import type { VideoAnnotation, VideoMode } from "@/components/video-annotation-activity/VideoAnnotationContext";

  // Props
  interface Props {
    annotations: VideoAnnotation[];
    currentFrame: number;
    currentMode: VideoMode;
    selectedAnnotationValue: AnnotationValue;
    toolInfo: ToolInfo;
    onSelectSubCategory: (params: { selectedMode: VideoMode; annotationValue: AnnotationValue }) => void;
    onSelectAnnotation: (annotation: VideoAnnotation) => void;
  }
  let {
    annotations,
    currentFrame,
    currentMode,
    selectedAnnotationValue,
    toolInfo,
    onSelectSubCategory,
    onSelectAnnotation,
  }: Props = $props();

  // Variables
  let search: string = $state("");
  let toolInfoOfCurrentMode = $derived(toolInfo[currentMode]);
</script>

<Sidebar variant="inset" collapsible="none" class="min-w-80">
  <!-- ANNOTATION::SIDEBAR::HEADER -->
  <SidebarHeader>
    {#if !toolInfoOfCurrentMode}
      <Input placeholder="Search annotations" bind:value={search} />
    {/if}
  </SidebarHeader>

  <!-- ANNOTATION::SIDEBAR::CONTENT -->
  <SidebarContent>
    {#if toolInfoOfCurrentMode && toolInfoOfCurrentMode.allowedFields.categories}
      <!-- TOOL INFO::ANNOTATION MODE -->
      <SidebarGroup>
        <SidebarGroupLabel>Category ({currentMode})</SidebarGroupLabel>

        <SidebarGroupContent>
          <SidebarMenu>
            <AnnotationSidebarCollapsibleCategories
              annotationType={currentMode}
              {annotations}
              categories={toolInfoOfCurrentMode.allowedFields.categories}
              {currentFrame}
              {selectedAnnotationValue}
              showCount
              {onSelectSubCategory}
              {onSelectAnnotation}
            />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    {:else}
      <!-- TOOL INFO::VIEW MODE -->
      {#each Object.entries(toolInfo) as [toolName, toolConfig]}
        {@const { allowedFields } = toolConfig}

        <SidebarGroupContent>
          <SidebarMenu>
            {#if allowedFields.categories}
              <AnnotationSidebarCollapsibleCategories
                annotationType={toolName}
                {annotations}
                categories={allowedFields.categories}
                {currentFrame}
                {selectedAnnotationValue}
                showCount
                {onSelectSubCategory}
                {onSelectAnnotation}
              />
            {:else}
              <SidebarMenuItem>
                <SidebarMenuButton>No Categories</SidebarMenuButton>
              </SidebarMenuItem>
            {/if}
          </SidebarMenu>
        </SidebarGroupContent>
      {/each}
    {/if}
  </SidebarContent>
</Sidebar>
