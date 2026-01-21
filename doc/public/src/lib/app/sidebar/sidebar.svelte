<script lang="ts">
  import AppSidebar from "$lib/app/sidebar/app-sidebar.svelte";
  import { SidebarProvider, SidebarTrigger } from "$lib/components/ui/sidebar";
</script>

<SidebarProvider>
  <AppSidebar>
    <SidebarTrigger />
  </AppSidebar>
</SidebarProvider>
