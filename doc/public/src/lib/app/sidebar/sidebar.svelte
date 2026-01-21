<script lang="ts">
  import AppSidebar from "$lib/app/sidebar/app-sidebar.svelte";
  import { SidebarProvider } from "$lib/components/ui/sidebar";
</script>

<aside class="hidden lg:block w-64 shrink-0 border-r">
  <SidebarProvider>
    <AppSidebar />
  </SidebarProvider>
</aside>
