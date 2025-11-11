<script lang="ts">
  import { page } from "$app/state";

  // Props
  let { children } = $props();

  let pluginId: string = page.params.pluginId as string;
  let jsloaded = $state(false);
  let cssloaded = $state(false);
  let loaded = $derived(jsloaded && cssloaded);
</script>

<svelte:head>
  <link
    rel="stylesheet"
    type="text/css"
    href="{import.meta.env.VITE_IDAH_HOST}/api/v1/setting/plugins/{pluginId}/files/plugin.css"
    onload={() => (cssloaded = true)}
  />
  <script
    src="{import.meta.env.VITE_IDAH_HOST}/api/v1/setting/plugins/{pluginId}/files/plugin.js"
    onload={() => (jsloaded = true)}
  ></script>
</svelte:head>

<div>
  {#if loaded}
    {@render children?.()}
  {/if}
</div>
