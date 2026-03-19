<script lang="ts">
  import {
    mobileSidebarItems,
    type SidebarType,
  } from "$lib/app/sidebar/sidebar.data";
  import { cn } from "$lib/utils";
  import SidebarItem from "./sidebar-item.svelte";
  import { mergeSidebarItemsWithApiUrls } from "$lib/app/sidebar/sidebar.utils";

  let {
    pathname,
    apiUrls,
  }: { pathname: string; apiUrls: { url: string; name: string }[] } = $props();

  const mergedSidebarItems = $derived<SidebarType[]>(
    mergeSidebarItemsWithApiUrls(mobileSidebarItems, apiUrls),
  );
</script>

<div class="h-full overflow-y-auto p-4 text-sm text-muted-foreground">
  {#each mergedSidebarItems as sidebar (sidebar.label)}
    <div class="mb-2 last:mb-0">
      {#if sidebar.href}
        <a
          href={sidebar.href}
          class={cn(
            "block w-full px-2 py-1.5 rounded-md transition-colors hover:bg-muted hover:text-primary cursor-pointer",
            {
              "text-primary bg-muted font-semibold": sidebar.href === pathname,
            },
          )}
        >
          {sidebar.label}
        </a>
      {:else}
        <div class="mb-2 px-2 font-semibold text-foreground">
          {sidebar.label}
        </div>
      {/if}

      {#if sidebar.children?.length}
        <nav class="flex flex-col gap-1">
          {#each sidebar.children as item (item.label)}
            <SidebarItem {item} {pathname} />
          {/each}
        </nav>
      {/if}
    </div>
  {/each}
</div>
