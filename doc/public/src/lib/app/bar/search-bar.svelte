<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import { InputGroup, InputGroupAddon, InputGroupInput } from "$lib/components/ui/input-group";
  import { cn } from "$lib/utils";
  import { SearchIcon, XIcon } from "@lucide/svelte";
  import { writable } from "svelte/store";

  const searchOpen = writable(false);

  function openSearch(): void {
    searchOpen.set(true);
  }

  function closeSearch(): void {
    searchOpen.set(false);
  }
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

<!-- <div class="relative flex w-full items-center"> -->
<div class="flex gap-2 w-full items-center justify-center">
  <div class="w-full max-w-xl hidden items-center lg:block">
    {@render searchInput()}
  </div>

  {#if $searchOpen}
    <div class="w-full max-w-xl lg:hidden">
      {@render searchInput()}
    </div>
  {/if}

  <div class="ml-auto flex items-center gap-1 lg:hidden">
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
