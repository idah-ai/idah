<script lang="ts">
  import { sidebarOpen, toggleSidebar } from "$lib/app/sidebar/sidebar.store";
  import Button from "$lib/components/ui/button/button.svelte";
  import { TextAlignJustifyIcon, XIcon } from "@lucide/svelte";
</script>

<Button data-sidebar-toggle variant="ghost" size="icon" class="lg:hidden" onclick={toggleSidebar}>
  {#if $sidebarOpen}
    <TextAlignJustifyIcon class="size-5" />
  {:else}
    <XIcon class="size-5" />
  {/if}
</Button>
