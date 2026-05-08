<script lang="ts">
  // -----------------------------------------------------------------------
  // /mock — V2 mock page showing the toolbar above the actual editor
  // -----------------------------------------------------------------------
  import { mount, unmount } from "svelte";
  import IdahVideoPlugin from "$lib/plugin/idah-video-plugin.svelte";
  import IdahToolbar from "./idah-toolbar.svelte";
  import IdahCommandPalette from "./idah-command-palette.svelte";
  import { IdahDriverV2 } from "$idah/v2/idah-driver";
  import { createV1Bridge } from "$idah/v2/bridge";
  import type { IToolbarItem } from "$idah/v2/types";

  // ── Create V2 driver ──────────────────────────────────────────────────
  const driver = new IdahDriverV2();
  const context = createV1Bridge(driver);

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
  let isCommandDialogOpen = $state(false);

  function refreshToolbar() {
    toolbarItems = driver.toolbarMgr.getItemsForMode(driver.mode);
    currentMode = driver.mode;
  }

  // ── Listen to mode changes to refresh toolbar ────────────────────────
  driver.onModeChange(() => { refreshToolbar(); });

  // ── Ctrl+Space toggles command palette (other shortcuts handled by the editor) ─
  $effect(() => {
    if (typeof window === "undefined") return;

    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        isCommandDialogOpen = !isCommandDialogOpen;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // ── Mount the editor when the target element is ready ─────────────────
  $effect(() => {
    if (!targetElement) return;

    mountedPlugin = mount(IdahVideoPlugin, {
      target: targetElement,
      props: { context },
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
  <IdahCommandPalette bind:open={isCommandDialogOpen} commandManager={driver.command} mode={currentMode} />

  <!-- V2 Toolbar — simulates the outer IDAH toolbar -->
  <IdahToolbar items={toolbarItems} onUndo={() => driver.command.undo()} onRedo={() => driver.command.redo()} />

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
