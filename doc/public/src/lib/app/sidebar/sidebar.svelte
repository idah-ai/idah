<script lang="ts">
  import AppSidebar from "$lib/app/sidebar/app-sidebar.svelte";
  import { SidebarProvider, SidebarTrigger } from "$lib/components/ui/sidebar";
</script>

<SidebarProvider class="hidden lg:block w-64 shrink-0 h-[calc(100vh-64px)]">
  <AppSidebar>
    <SidebarTrigger />
  </AppSidebar>
</SidebarProvider>
