<script lang="ts">
  import { closeSearch, openSearch, searchOpen } from "$lib/app/bar/search-bar.store";
  import { sidebarOpen } from "$lib/app/sidebar/sidebar.store";
  import Button from "$lib/components/ui/button/button.svelte";
  import { cn } from "$lib/utils";
  import { SearchIcon, XIcon } from "@lucide/svelte";
</script>

<div
  class={cn("flex items-center gap-1 lg:hidden shrink-0", {
    hidden: $sidebarOpen,
  })}
>
  <Button class={cn({ hidden: !$searchOpen })} variant="ghost" size="icon" onclick={closeSearch}>
    <XIcon />
  </Button>

  <Button class={cn({ hidden: $searchOpen })} variant="ghost" size="icon" onclick={openSearch}>
    <SearchIcon />
  </Button>
</div>
