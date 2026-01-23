<script lang="ts">
  import { closeSearch, openSearch, searchOpen } from "$lib/app/bar/search-bar.store";
  import { sidebarOpen } from "$lib/app/sidebar/sidebar.store";
  import Button from "$lib/components/ui/button/button.svelte";
  import { InputGroup, InputGroupAddon, InputGroupInput } from "$lib/components/ui/input-group";
  import { cn } from "$lib/utils";
  import { SearchIcon, XIcon } from "@lucide/svelte";
</script>

{#snippet searchInput()}
  <InputGroup class="relative">
    <InputGroupAddon class="pointer-events-none">
      <SearchIcon />
    </InputGroupAddon>

    <InputGroupInput placeholder="Search..." class="w-full" />

    <InputGroupAddon class="lg:hidden" align="inline-end">
      <Button variant="ghost" size="icon">
        <XIcon />
      </Button>
    </InputGroupAddon>
  </InputGroup>
{/snippet}

<div class="flex gap-1 w-full items-center justify-center">
  <div class="w-full max-w-xl hidden items-center lg:block">
    {@render searchInput()}
  </div>

  {#if $searchOpen}
    <div class="fixed w-auto w-full max-w-xl left-1/2 -translate-x-1/2 lg:hidden">
      {@render searchInput()}
    </div>
  {/if}

  <div
    class={cn("ml-auto flex items-center gap-1 lg:hidden", {
      hidden: $sidebarOpen,
    })}
  >
    <Button
      class={cn("", {
        hidden: !$searchOpen,
      })}
      variant="ghost"
      size="icon"
      onclick={closeSearch}
    >
      <XIcon />
    </Button>

    <Button
      class={cn("", {
        hidden: $searchOpen,
      })}
      variant="ghost"
      size="icon"
      onclick={openSearch}
    >
      <SearchIcon />
    </Button>
  </div>
</div>
