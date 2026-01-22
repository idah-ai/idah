<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import { SearchIcon } from "@lucide/svelte";
</script>

<Button id="mobile-search" variant="ghost" size="icon" class="lg:hidden">
  <SearchIcon class="size-5" />
</Button>
