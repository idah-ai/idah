<script lang="ts">
  import { searchOpen } from "$lib/app/bar/search-bar.store";
  import Button from "$lib/components/ui/button/button.svelte";
  import { SearchIcon } from "@lucide/svelte";

  function handleClick() {
    searchOpen.set(true);
    // Focus on input after a small delay to ensure it's rendered
    setTimeout(() => {
      const input = document.querySelector('input[placeholder="Search documentation..."]') as HTMLInputElement;
      input?.focus();
    }, 100);
  }
</script>

<Button variant="ghost" size="icon" class="md:hidden" onclick={handleClick}>
  <SearchIcon class="size-5" style="color: #2391ea;" />
</Button>
