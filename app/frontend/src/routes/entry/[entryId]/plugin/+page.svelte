<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  // lets keep it simple for now and wait backend integration
  onMount(() => { goto(`plugin/idah-video`); });
</script>
