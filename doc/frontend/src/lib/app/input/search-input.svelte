<script lang="ts">
  import { InputGroup, InputGroupAddon, InputGroupInput } from "$lib/components/ui/input-group";
  import { SearchIcon } from "@lucide/svelte";
</script>

<div class="absolute left-1/2 hidden w-full max-w-xl -translate-x-1/2 xl:block">
  <InputGroup>
    <InputGroupInput placeholder="Search..." class="w-full" />
    <InputGroupAddon class="pointer-events-none">
      <SearchIcon class="text-muted-foreground size-4" />
    </InputGroupAddon>
  </InputGroup>
</div>
