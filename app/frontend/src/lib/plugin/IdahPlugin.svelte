<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import type { IdahDriverV2 } from "./v2/driver";
  import type { IPluginDriver } from "./v2/types";

  import AnnotationHeaderBar from "@/plugin/layout/header/annotation-header-bar.svelte";
  import IdahCommandPalette from "./v2/components/idah-command-palette.svelte";

  import { authStatus } from "@/security/AuthContext";

  interface Props {
    driver: IdahDriverV2;
  }
  let { driver }: Props = $props();

  // Variables
  let pluginContainerElement = $state<HTMLElement | null>(null);
  let headerBarElement = $state<HTMLElement | null>(null);
  let headerBarHeight = $derived(headerBarElement?.clientHeight ?? 50);
  let plugin: IPluginDriver | undefined = $state();

  let p: Promise<IPluginDriver> = new Promise<IPluginDriver>((ok, ko) => {
    if (!window.idah_plugin) {
      ko();
    } else {
      ok(window.idah_plugin as IPluginDriver);
    }
  });
  // ── Listen to mode changes to refresh toolbar ────────────────────────
  let currentMode = $state(driver.mode);
  let paletteOpen = $state(driver.command.isPaletteOpen());
  let initialized = $state(false);

  driver.onModeChange((event) => {
    currentMode = event.newValue;
  });

  onMount(() => {
    p.then((_plugin) => {
      plugin = _plugin;
      plugin.init(driver);
      initialized = true; // quick fix for now to ensure plugin initialization before rendering toolbar(Items)
    });
    // Load the user's saved shortcut overrides into the live map that
    // CommandManagerV2 already references, so remaps apply immediately.
    void driver.accountSettings.load($authStatus.authContext?.id ?? "");
    const unsub = driver.command.onPaletteChange((open: boolean) => {
      paletteOpen = open;
    });
    return unsub;
  });

  $effect(() => {
    if (!plugin) return;
    if (!pluginContainerElement) return;
    if (initialized) plugin.render(pluginContainerElement);
  });

  onDestroy(() => {
    plugin?.close();
  });
</script>

<div class="relative">
  {#if initialized}
    <AnnotationHeaderBar bind:ref={headerBarElement} {pluginContainerElement} {driver} />

    <IdahCommandPalette
      open={paletteOpen}
      onOpenChange={(o) => driver.command.openPalette(o)}
      commandManager={driver.command}
      mode={currentMode}
      accountSettings={driver.accountSettings}
    />
  {/if}
  <!-- Plugin Container -->
  <div style:height={`calc(100vh - ${headerBarHeight + 1}px)`} bind:this={pluginContainerElement}>
    {#await p}
      Loading Plugins
    {:then}
      should be overriden by plugin render
    {:catch}
      Could not find plugin
    {/await}
  </div>
</div>
