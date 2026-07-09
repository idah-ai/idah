<script lang="ts">
  import { page } from "$app/state";

  // Props
  let { children } = $props();

  const rawPluginId = page.params.pluginId as string;
  // Only allow safe plugin identifiers. Rejecting path/protocol characters
  // (":", "/", ".", "%") keeps the value a single path segment under
  // VITE_IDAH_HOST, so a crafted id can't load attacker JS in this origin.
  const pluginId = /^[A-Za-z0-9_-]+$/.test(rawPluginId) ? rawPluginId : null;
  let jsloaded = $state(false);
  let cssloaded = $state(false);
  let loaded = $derived(jsloaded && cssloaded);
</script>

<svelte:head>
  {#if pluginId}
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
  {/if}
</svelte:head>

{#if loaded}
  {@render children?.()}
{/if}
