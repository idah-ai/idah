<script lang="ts">
  import { mobileSidebarItems, type SidebarType } from "$lib/app/sidebar/sidebar.data";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "$lib/components/ui/collapsible";
  import { ChevronRightIcon } from "@lucide/svelte";

  let open = $state(true);
</script>

{#snippet getMobileApplicationSidebarItem(item: SidebarType)}
  {@const hasChildren = item.children?.length > 0}

  {#if hasChildren}
    <Collapsible class="group/collapsible w-full" {open}>
      <CollapsibleTrigger asChild class="w-full cursor-pointer justify-between">
        <button
          type="button"
          class="flex w-full items-center justify-between rounded-md
                 px-2 py-1.5 text-left
                 hover:cursor-pointer
                 transition-colors"
        >
          <span>{item.label}</span>

          <ChevronRightIcon
            class="
                size-5 lg:size-4
                transition-transform duration-300 ease-out
                group-data-[state=open]/collapsible:rotate-90
              "
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent class="mt-1">
        <div class="ml-4 flex flex-col gap-1">
          {#each item.children as child (child.label)}
            {@render getMobileApplicationSidebarItem(child)}
          {/each}
        </div>
      </CollapsibleContent>
    </Collapsible>
  {:else if item.href}
    <a
      href={item.href}
      class="
    block w-full
    px-2 py-1.5
    rounded-md
    transition-colors
    hover:bg-muted
    hover:text-primary
    cursor-pointer
  "
    >
      {item.label}
    </a>
  {:else}
    <div class="px-2 py-1.5 text-muted-foreground">
      {item.label}
    </div>
  {/if}
{/snippet}

<div class="h-full overflow-y-auto p-4 text-sm text-muted-foreground">
  {#each mobileSidebarItems as sidebar (sidebar.label)}
    <div class="mb-2 last:mb-0">
      {#if sidebar.href}
        <a
          href={sidebar.href}
          class="
    block w-full
    px-2 py-1.5
    rounded-md
    transition-colors
    hover:bg-muted
    hover:text-primary
    cursor-pointer
  "
        >
          {sidebar.label}
        </a>
      {:else}
        <div class="mb-2 px-2 font-semibold text-foreground">
          {sidebar.label}
        </div>
      {/if}

      <nav class="flex flex-col gap-1">
        {#each sidebar.children as item (item.label)}
          {@render getMobileApplicationSidebarItem(item)}
        {/each}
      </nav>
    </div>
  {/each}
</div>
