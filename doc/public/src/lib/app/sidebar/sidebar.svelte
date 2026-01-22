<script lang="ts">
  import AppSidebar from "$lib/app/sidebar/app-sidebar.svelte";
  import { sidebarOpen } from "$lib/app/sidebar/sidebar.store";
  import { SidebarProvider } from "$lib/components/ui/sidebar";

  let { pathname }: { pathname: string } = $props();
</script>

{#if $sidebarOpen}
  <div class="fixed inset-0 z-20 bg-black/40 lg:hidden" on:click={() => sidebarOpen.set(false)} />
{/if}

<!-- Sidebar -->
<SidebarProvider
  class="
    fixed left-0 z-30 w-64
    bg-background
    transition-transform duration-300 ease-out
    -translate-x-full
    {$sidebarOpen ? 'translate-x-0' : ''}

    lg:static lg:translate-x-0
  "
>
  <AppSidebar {pathname} />
</SidebarProvider>
