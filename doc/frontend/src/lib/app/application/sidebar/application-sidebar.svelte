<script lang="ts">
  import { desktopSidebarItems, type SidebarType } from "$lib/app/sidebar/sidebar.data";
  import { mergeSidebarItemsWithApiUrls } from "$lib/app/sidebar/sidebar.utils";
  import { ChevronDown, ChevronRight } from "@lucide/svelte";

  let { pathname, apiUrls }: { pathname: string; apiUrls: { url: string; name: string }[] } = $props();

  const mergedSidebarItems = $derived<SidebarType[]>(mergeSidebarItemsWithApiUrls(desktopSidebarItems, apiUrls));

  // Track which third-level items are expanded
  let expandedItems = $state<Record<string, boolean>>({});

  // Initialize expanded items based on active pathname
  $effect(() => {
    mergedSidebarItems.forEach((section) => {
      section.children?.forEach((child) => {
        const hasActiveGrandchild = child.children?.some((grandchild) => grandchild.href === pathname);
        if (hasActiveGrandchild) {
          expandedItems[child.label] = true;
        }
      });
    });
  });

  function toggleItem(label: string) {
    expandedItems[label] = !expandedItems[label];
  }

  function isActive(href?: string): boolean {
    return href === pathname;
  }

  function hasActiveChild(item: SidebarType): boolean {
    return item.children?.some((child) => child.href === pathname || hasActiveChild(child)) || false;
  }
</script>

<div class="flex h-full w-full flex-col bg-background">
  <nav class="flex-1 space-y-1 px-3 py-4">
    {#each mergedSidebarItems as section (section.label)}
      <div class="mb-6">
        <!-- Section header (always visible) -->
        <div class="mb-2 px-3 text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          {section.label}
        </div>

        <!-- First-level children (always visible) -->
        {#if section.children?.length}
          <div class="space-y-1">
            {#each section.children as child (child.label)}
              <div>
                {#if child.children?.length}
                  <!-- Item with third-level children - has dropdown -->
                  <button
                    type="button"
                    onclick={() => toggleItem(child.label)}
                    class="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <span>{child.label}</span>
                    {#if expandedItems[child.label]}
                      <ChevronDown class="h-4 w-4" />
                    {:else}
                      <ChevronRight class="h-4 w-4" />
                    {/if}
                  </button>

                  <!-- Third-level children (dropdown) -->
                  {#if expandedItems[child.label]}
                    <div class="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 bg-gray-50/50 py-2 pl-3 dark:border-gray-700 dark:bg-gray-800/30">
                      {#each child.children as grandchild (grandchild.label)}
                        <a
                          href={grandchild.href}
                          class="block rounded-md px-3 py-1.5 text-xs transition-colors {isActive(grandchild.href)
                            ? 'bg-blue-100 font-medium text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'}"
                        >
                          {grandchild.label}
                        </a>
                      {/each}
                    </div>
                  {/if}
                {:else}
                  <!-- Simple link without children -->
                  <a
                    href={child.href}
                    class="block rounded-md px-3 py-2 text-sm transition-colors {isActive(child.href)
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}"
                  >
                    {child.label}
                  </a>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </nav>
</div>
