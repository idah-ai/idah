<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import AnnotationHeaderBar from "@/plugin/layout/header/AnnotationHeaderBar.svelte";

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
      ko();
    } else {
      ok(window.idah_plugin as IActivityView);
    }
  });

  onMount(() => {
    p.then((_plugin) => {
      plugin = _plugin;
      console.debug({ plugin: $state.snapshot(plugin), container, context });
      plugin.render?.(container, context);
    });
  });

  onDestroy(() => {
    plugin?.close?.();
  });
</script>

<div>
  <AnnotationHeaderBar {context} />
  <!-- Plugin Container -->
  <div class="h-[calc(100vh-58px)]" bind:this={container}>
    <!-- AnnotationHeaderBar 58 px \o/ ? -->
    {#await p}
      Loading Plugins
    {:then}
      should be overriden by plugin render
    {:catch}
      Could not find plugin
    {/await}
  </div>
</div>
