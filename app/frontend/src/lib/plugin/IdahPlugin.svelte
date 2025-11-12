<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import AnnotationHeaderBar from "@/plugin/layout/header/annotation-header-bar.svelte";

  import type { IActivityContext, IActivityView } from "./interface/Activity";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();

  // Variables
  let PluginContainerElement = $state<HTMLElement | null>(null);
  let HeaderBarElement = $state<HTMLElement | null>(null);
  let headerBarHeight = $derived(HeaderBarElement?.clientHeight ?? 50);
  let plugin: IActivityView | undefined = $state();

  let p: Promise<IActivityView> = new Promise<IActivityView>((ok, ko) => {
    if (!window.idah_plugin) {
      ko();
    } else {
      ok(window.idah_plugin as IActivityView);
    }
  });

  onMount(() => {
    p.then((_plugin) => {
      plugin = _plugin;
      // console.debug({ plugin: $state.snapshot(plugin), PluginContainerElement, context });
      plugin.render?.(PluginContainerElement, context);
    });
  });

  onDestroy(() => {
    plugin?.close?.();
  });
</script>

<div class="relative">
  <AnnotationHeaderBar bind:ref={HeaderBarElement} pluginContainerElement={PluginContainerElement} {context} />

  <!-- Plugin Container -->
  <div style:height={`calc(100vh - ${headerBarHeight}px)`} bind:this={PluginContainerElement}>
    {#await p}
      Loading Plugins
    {:then}
      should be overriden by plugin render
    {:catch}
      Could not find plugin
    {/await}
  </div>
</div>
