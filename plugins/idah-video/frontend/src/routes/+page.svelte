<script lang="ts">
  import { mount, unmount } from "svelte";
  import IdahVideoPlugin from "$lib/plugin/idah-video-plugin.svelte";
  import { mockContext } from "$mock/context";
  // ── TODO: Use real V2 driver here once integrated ─────────────────────
  import { IdahDriverV2 } from "$idah/v2/idah-driver";
  import { createV1Bridge } from "$idah/v2/bridge";
  import { initDriver } from "$lib/state/driver.svelte";
  import { initDataStores } from "$lib/state/data.svelte";
  import { registerAllCommands } from "$lib/commands";

  const driver = new IdahDriverV2();
  initDriver(driver);
  initDataStores();
  registerAllCommands(driver);

  const v2context = createV1Bridge(driver);

  let targetElement: HTMLDivElement;
  let mounted: object | undefined = $state();

  $effect(() => {
    if (!targetElement) return;

    mounted = mount(IdahVideoPlugin, {
      target: targetElement,
      props: { context: v2context },
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
