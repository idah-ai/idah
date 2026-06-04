<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import type { IdahDriverV2 } from "./v2/driver";
  import type { IPluginDriver } from "./v2/types";

  import AnnotationHeaderBar from "@/plugin/layout/header/annotation-header-bar.svelte";
  import IdahCommandPalette from "./v2/components/idah-command-palette.svelte";
  import NoteOverlay from "@/plugin/layout/notes/NoteOverlay.svelte";
  import NoteSidebar from "@/plugin/layout/sidebar/notes/note-sidebar.svelte";

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

  let noteSidebarOpen = $state(true);

  driver.onModeChange((event) => {
    currentMode = event.newValue;
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

    <AnnotationHeaderBar bind:ref={headerBarElement} {pluginContainerElement} {driver} />

    <IdahCommandPalette
      open={paletteOpen}
      onOpenChange={(o) => driver.command.openPalette(o)}
      commandManager={driver.command}
      mode={currentMode}
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

  <!-- Note Sidebar toggle button (visible when in review workspace and sidebar closed) -->
  {#if initialized && (currentMode === "review" || currentMode === "note") && !noteSidebarOpen}
    <button
      class="bg-primary text-primary-foreground hover:bg-primary/90 fixed right-0 z-[100] flex h-12 w-7 items-center justify-center rounded-l-md shadow-md"
      style="top: {headerBarHeight + 8}px;"
      onclick={() => (noteSidebarOpen = true)}
      title="Open notes"
      aria-label="Open notes"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"><path d="m18 18 -6-6 6-6" /></svg
      >
    </button>
  {/if}

  <!-- Note Sidebar (overlay) -->
  <NoteSidebar
    {driver}
    open={initialized && (currentMode === "review" || currentMode === "note") && noteSidebarOpen}
    onSidebarClose={() => (noteSidebarOpen = false)}
  />
</div>
