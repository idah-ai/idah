<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  // lets keep it simple for now and wait backend integration
  onMount(() => {
    goto(`plugin/idah-video`);
  });
</script>
