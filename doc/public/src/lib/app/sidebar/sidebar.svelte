<script lang="ts">
  import AppSidebar from "$lib/app/sidebar/app-sidebar.svelte";
  import { SidebarProvider } from "$lib/components/ui/sidebar";

  let { pathname }: { pathname: string } = $props();
</script>

<SidebarProvider class="hidden lg:block w-64 shrink-0">
  <AppSidebar {pathname} />
</SidebarProvider>
