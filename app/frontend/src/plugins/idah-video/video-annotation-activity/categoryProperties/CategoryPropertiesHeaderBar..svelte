<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";
  import { ArrowLeftIcon } from "@lucide/svelte";
</script>

<nav id="category-header-bar" class="flex items-center justify-between gap-2 pb-2">
  <div id="category-navigations" class="flex h-full flex-1 items-center gap-2">
    <!-- BACK BUTTON -->
    <Button variant="ghost">
      <ArrowLeftIcon class="size-4" />
      Back
    </Button>

    <Separator orientation="vertical" />

    <!-- MEDIA NAME -->
    <Button variant="ghost">category</Button>
  </div>
</nav>
