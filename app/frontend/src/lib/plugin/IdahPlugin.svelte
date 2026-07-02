<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import type { IdahDriverV2 } from "./v2/driver";
  import type { IPluginDriver } from "./v2/types";

  import AnnotationHeaderBar from "@/plugin/layout/header/annotation-header-bar.svelte";
  import IdahCommandPalette from "./v2/components/idah-command-palette.svelte";
  import NoteOverlay from "@/plugin/layout/notes/NoteOverlay.svelte";
  import NoteSidebar from "@/plugin/layout/sidebar/notes/note-sidebar.svelte";

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
  let notesReady = $state(false);

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

  let noteSidebarOpen = $state(driver.notesAdapter!.noteSidebarOpen);

  driver.onModeChange((event) => {
    currentMode = event.newValue;
  });

  driver.notesAdapter!.onNoteSidebarChange((open) => {
    noteSidebarOpen = open;
  });

  onMount(() => {
    // Initialise notes cache from backend
    const na = driver.notesAdapter;
    if (na) {
      na.fetchForEntry()
        .then(() => {
          notesReady = true;
        })
        .catch(() => {
          notesReady = true;
        });
    } else {
      notesReady = true;
    }

    p.then((_plugin) => {
      plugin = _plugin;
      plugin.init(driver.sealed());
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
    {#if notesReady && (currentMode === "review" || currentMode === "note")}
      <NoteOverlay notesAdapter={driver.notesAdapter} />
    {/if}

    <AnnotationHeaderBar bind:ref={headerBarElement} {driver} />

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

  <!-- Note Sidebar (overlay) -->
  <NoteSidebar
    {driver}
    open={initialized && (currentMode === "review" || currentMode === "note") && noteSidebarOpen}
    onSidebarClose={() => {
      noteSidebarOpen = false;
      driver.notesAdapter!.closeNoteSidebar();
    }}
  />
</div>
