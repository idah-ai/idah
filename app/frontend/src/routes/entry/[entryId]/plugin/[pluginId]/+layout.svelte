<script lang="ts">
  import { page } from "$app/state";
    import { onMount } from "svelte";

  // Props
  let { children } = $props();

  let pluginId: string = page.params.pluginId as string;

  let mounted = $state(false);

  onMount(() => mounted = true)
</script>

<svelte:head>
  <link rel="stylesheet" href="/build/plugins/frontend.css">
  <script src="/build/plugins/{pluginId}.umd.js">
  </script>
</svelte:head>

<div>
    {@render children?.()}
</div>
