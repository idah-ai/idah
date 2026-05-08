<script lang="ts">
  import { mount, unmount } from "svelte";
  import Plugin from "$lib/components/Plugin.svelte";
  // ── TODO: Use real V2 driver here once integrated ─────────────────────
  import { IdahDriverV2 } from "$idah/v2/idah-driver";
  import { initDriver } from "$lib/state/driver.svelte";
  import { initDataStores } from "$lib/state/data.svelte";
  import { registerAllCommands } from "$lib/commands";

  const driver = new IdahDriverV2();
  initDriver(driver);
  initDataStores();
  registerAllCommands(driver);

  let targetElement: HTMLDivElement;
  let mounted: object | undefined = $state();

  $effect(() => {
    if (!targetElement) return;

    mounted = mount(Plugin, {
      target: targetElement,
    });

    return () => {
      if (mounted) {
        unmount(mounted);
        mounted = undefined;
      }
    };
  });
</script>

<div bind:this={targetElement} class="h-screen w-screen overflow-hidden"></div>
