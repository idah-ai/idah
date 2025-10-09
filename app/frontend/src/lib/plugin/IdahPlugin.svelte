<script lang="ts">
  import { getContext, onDestroy, onMount } from "svelte";
  import type { IActivityContext, IActivityView } from "./interface/Activity";
  import type { PluginManager } from "./PluginManager";

  // Props
  interface Props {
    context: IActivityContext;
    pluginId: string;
  }
  let { context, pluginId }: Props = $props();

  // Variables
  let container: HTMLElement;
  let plugin: IActivityView | undefined = $state();
  let pluginManager: PluginManager = getContext("idah-plugin-manager");

  // Lifecycle
  onMount(() => {
    pluginManager.loadedPromise.then(() => {
      plugin = pluginManager.getPlugin(pluginId);
      if (!plugin) return console.error("plugin not found", { pluginId });

      console.debug("Mounting plugin", $state.snapshot(plugin));
      plugin.render?.(container, context);
    });
  });

  onDestroy(() => {
    plugin?.close?.();
  });
</script>

<div bind:this={container}>
  {#await pluginManager.loadedPromise}
    Loading Plugins
  {:then}
    {#key plugin}
      {#if plugin}
        plugin render
      {:else}
        No registered {pluginId} plugin found
      {/if}
    {/key}
  {/await}
</div>
