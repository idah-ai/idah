<script lang="ts">
  import { toggleSidebar } from "$lib/app/sidebar/sidebar.store";
  import Button from "$lib/components/ui/button/button.svelte";
  import { TextAlignJustifyIcon } from "@lucide/svelte";
</script>

<Button id="sidebar-toggle" variant="ghost" size="icon" class="lg:hidden" onclick={toggleSidebar}>
  <TextAlignJustifyIcon class="size-5" />
</Button>
