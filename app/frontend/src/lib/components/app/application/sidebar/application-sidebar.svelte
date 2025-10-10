<script lang="ts">
  import type { ComponentProps } from "svelte";

  import ApplicationSidebarContent from "@/components/app/application/sidebar/application-sidebar-content.svelte";
  import ApplicationSidebarFooter from "@/components/app/application/sidebar/application-sidebar-footer.svelte";
  import ApplicationSidebarHeader from "@/components/app/application/sidebar/application-sidebar-header.svelte";
  import SidebarRail from "@/components/ui/sidebar/sidebar-rail.svelte";
  import Sidebar from "@/components/ui/sidebar/sidebar.svelte";

  // Props
  let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar> = $props();
</script>

<Sidebar bind:ref variant="inset" {...restProps}>
  <ApplicationSidebarHeader></ApplicationSidebarHeader>
  <ApplicationSidebarContent></ApplicationSidebarContent>
  <ApplicationSidebarFooter></ApplicationSidebarFooter>

  <SidebarRail></SidebarRail>
</Sidebar>
