<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { IActivityContext, IActivityView } from "./interface/Activity";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();

  // Variables
  let container: HTMLElement;
  let plugin: IActivityView | undefined = $state();

  let p: Promise<IActivityView> = new Promise<IActivityView>((ok, ko) => {
    if (!window.idah_plugin) {
      // expect plugin to
      ko();
    } else {
      ok(window.idah_plugin as IActivityView);
    }
    // checkPluginLoaded(ok, ko)
  });

  onMount(() => {
    p.then((_plugin) => {
      plugin = _plugin;
      console.log("plugin loaded", { plugin: $state.snapshot(plugin) });
      plugin.render?.(container, context);
    });
  });

  onDestroy(() => {
    plugin?.close?.();
  });
</script>

<div bind:this={container}>
  {#await p}
    Loading Plugins
  {:then}
    should be overriden by plugin render
  {:catch}
    Could not find plugin
  {/await}
</div>
