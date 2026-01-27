<script lang="ts">
  import { closeSearch, openSearch, searchOpen } from "$lib/app/bar/search-bar.store";
  import { sidebarOpen } from "$lib/app/sidebar/sidebar.store";
  import Button from "$lib/components/ui/button/button.svelte";
  import { InputGroup, InputGroupAddon, InputGroupInput } from "$lib/components/ui/input-group";
  import { cn } from "$lib/utils";
  import { SearchIcon, XIcon } from "@lucide/svelte";
</script>

<div class="relative flex w-full items-center justify-center">
  <!-- SEARCH INPUT -->
  <div
    class={cn(
      `
      flex-1
      min-w-[240px]
      max-w-xl
      items-center
      `,
      {
        "hidden lg:block": !$searchOpen,
        block: $searchOpen,
      },
    )}
  >
    <InputGroup class="w-full">
      <InputGroupAddon class="pointer-events-none">
        <SearchIcon class="h-4 w-4" />
      </InputGroupAddon>

      <InputGroupInput placeholder="Search..." class="w-full" />

      <InputGroupAddon class="lg:hidden" align="inline-end">
        <Button variant="ghost" size="icon" onclick={closeSearch}>
          <XIcon class="h-4 w-4" />
        </Button>
      </InputGroupAddon>
    </InputGroup>
  </div>

  <!-- MOBILE ACTION BUTTONS -->
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
</div>
