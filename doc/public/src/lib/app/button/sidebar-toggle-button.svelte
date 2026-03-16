<script lang="ts">
  import { searchOpen } from "$lib/app/bar/search-bar.store";
  import { sidebarOpen, toggleSidebar } from "$lib/app/sidebar/sidebar.store";
  import Button from "$lib/components/ui/button/button.svelte";
  import { cn } from "$lib/utils";
  import { TextAlignJustifyIcon, XIcon } from "@lucide/svelte";
</script>

<Button
  data-sidebar-toggle
  variant="ghost"
  size="icon"
  class={cn("lg:hidden", {
    hidden: $searchOpen,
  })}
  onclick={toggleSidebar}
>
  {#if !$sidebarOpen}
    <TextAlignJustifyIcon class="size-5" />
  {:else}
    <XIcon class="size-5" />
  {/if}
</Button>
