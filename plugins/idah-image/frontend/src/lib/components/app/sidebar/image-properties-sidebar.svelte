<script lang="ts">
  import CategoryProperties from "$lib/components/app/sidebar/properties/category-properties.svelte";
  import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
  } from "$lib/components/ui/sidebar";
</script>

<Sidebar variant="inset" collapsible="none" style="w-full" side="right">
  <SidebarHeader></SidebarHeader>

  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupContent>
        <!-- {#key [annotationValue, mode, $entryRoot?.value.category]} -->
        <CategoryProperties type="text" />
        <!-- {/key} -->
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>
