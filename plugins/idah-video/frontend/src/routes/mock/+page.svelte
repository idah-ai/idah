<script lang="ts">
  // -----------------------------------------------------------------------
  // /mock — V2 mock page showing the toolbar above the actual editor
  // -----------------------------------------------------------------------
  import { mount, unmount } from "svelte";
  import Plugin from "$lib/components/Plugin.svelte";
  import IdahToolbar from "./idah-toolbar.svelte";
  import IdahCommandPalette from "./idah-command-palette.svelte";
  import { IdahDriverV2 } from "./mock-driver";
  import type { IToolbarItem } from "$idah/v2/types";

  // ── Create V2 driver ──────────────────────────────────────────────────
  const driver = new IdahDriverV2();

  // ── Wire global singletons BEFORE any component mounts ────────────────
  import { initDriver } from "$lib/state/driver.svelte";
  import { initDataStores } from "$lib/state/data.svelte";
  initDriver(driver);
  initDataStores();

  // ── Register commands and toolbar ─────────────────────────────────────
  import { registerAllCommands } from "$lib/commands";
  import { initToolbar } from "$lib/toolbar";
  registerAllCommands(driver);
  initToolbar(driver);

  // ── State ─────────────────────────────────────────────────────────────
  let targetElement: HTMLDivElement;
  let toolbarItems = $state<IToolbarItem[]>([]);
  let currentMode = $state(driver.mode);
  let mountedPlugin: object | undefined = $state();
  let paletteOpen = $state(driver.command.isPaletteOpen());
  let canUndo = $state(driver.command.canUndo());
  let canRedo = $state(driver.command.canRedo());

  function refreshToolbar() {
    toolbarItems = driver.toolbarMgr.getItemsForMode(driver.mode);
    currentMode = driver.mode;
    canUndo = driver.command.canUndo();
    canRedo = driver.command.canRedo();
  }

  // ── Listen to mode changes to refresh toolbar ────────────────────────
  driver.onModeChange(() => { refreshToolbar(); });

  // Refresh toolbar after any command (for undo/redo state)
  driver.command.onPaletteChange(() => { refreshToolbar(); });

  // ── Sync palette state from driver ────────────────────────────────────
  $effect(() => {
    const unsub = driver.command.onPaletteChange((open: boolean) => { paletteOpen = open; });
    return unsub;
  });

  // ── Mount the editor when the target element is ready ─────────────────
  $effect(() => {
    if (!targetElement) return;

    mountedPlugin = mount(Plugin, {
      target: targetElement,
    });

    return () => {
      if (mountedPlugin) {
        unmount(mountedPlugin);
        mountedPlugin = undefined;
      }
    };
  });

  // ── Init toolbar display ──────────────────────────────────────────────
  refreshToolbar();
</script>

<div class="mock-shell">
  <!-- Command Palette — driven by V2 driver shortcut references -->
  <IdahCommandPalette
    open={paletteOpen}
    onOpenChange={(o) => driver.command.openPalette(o)}
    commandManager={driver.command}
    mode={currentMode}
  />

  <!-- V2 Toolbar — simulates the outer IDAH toolbar -->
  <IdahToolbar
    items={toolbarItems}
    onUndo={() => { driver.command.undo(); refreshToolbar(); }}
    onRedo={() => { driver.command.redo(); refreshToolbar(); }}
    {canUndo}
    {canRedo}
  />

  <!-- Editor area — the actual VideoAnnotationActivity -->
  <div bind:this={targetElement} class="editor-area"></div>
</div>

<style>
  .mock-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: var(--background, #fff);
  }
  .editor-area {
    flex: 1;
    min-height: 0; /* allow shrink */
    overflow: hidden;
  }
</style>
