<script lang="ts">
  import AppSidebar from "$lib/app/sidebar/app-sidebar.svelte";
  import { sidebarOpen } from "$lib/app/sidebar/sidebar.store";
  import { SidebarProvider } from "$lib/components/ui/sidebar";

  let { pathname }: { pathname: string } = $props();
</script>

<!-- Overlay (mobile) -->
{#if $sidebarOpen}
  <div class="fixed inset-0 z-20 bg-black/40 lg:hidden" on:click={() => sidebarOpen.set(false)} />
{/if}

<SidebarProvider
  class="
    z-30 w-64
    bg-background
    transition-transform duration-300 ease-out
    lg:static lg:translate-x-0
    {$sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
  "
>
  <AppSidebar {pathname} />
</SidebarProvider>
