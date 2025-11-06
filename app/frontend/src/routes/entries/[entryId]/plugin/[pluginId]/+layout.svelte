<script lang="ts">
  import { page } from "$app/state";

  // Props
  let { children } = $props();

  let pluginId: string = page.params.pluginId as string;
</script>

<svelte:head>
  <link
    rel="stylesheet"
    type="text/css"
    href="{import.meta.env.VITE_IDAH_HOST}/api/v1/setting/plugins/{pluginId}/files/plugin.css"
  />
  <script src="{import.meta.env.VITE_IDAH_HOST}/api/v1/setting/plugins/{pluginId}/files/plugin.js">
  </script>
</svelte:head>

<div>
  {@render children?.()}
</div>
