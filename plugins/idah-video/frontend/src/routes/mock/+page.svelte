<script lang="ts">
  // -----------------------------------------------------------------------
  // /mock — V2 mock page showing the toolbar above the actual editor
  // -----------------------------------------------------------------------
  import { mount, unmount } from "svelte";
  import IdahVideoPlugin from "$lib/plugin/idah-video-plugin.svelte";
  import IdahToolbar from "./idah-toolbar.svelte";
  import { IdahDriverV2 } from "$idah/v2/idah-driver";
  import { createV1Bridge } from "$idah/v2/bridge";
  import type { IToolbarItem } from "$idah/v2/types";

  // ── Create V2 driver ──────────────────────────────────────────────────
  const driver = new IdahDriverV2();
  const context = createV1Bridge(driver);

  // ── State ─────────────────────────────────────────────────────────────
  let targetElement: HTMLDivElement;
  let toolbarItems = $state<IToolbarItem[]>([]);
  let currentMode = $state(driver.mode);
  let mountedPlugin: object | undefined = $state();

  // ── Register V2 toolbar items (mocking IDAH's outer toolbar) ─────────

  const cursorIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/></svg>`;
  const rectIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
  const polyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L22 8.5V15.5L12 22L2 15.5V8.5L12 2z"/></svg>`;
  const noteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>`;
  const undoIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`;
  const redoIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>`;

  function registerMockToolbar() {
    // Mode switching tools (selection group)
    driver.toolbarMgr.add(cursorIcon, "default", "selection", () => { driver.setMode("default"); }, undefined, () => driver.mode === "default");
    driver.toolbarMgr.add(rectIcon, "idah-video:bounding-box", "selection", () => { driver.setMode("idah-video:bounding-box"); }, undefined, () => driver.mode === "idah-video:bounding-box");
    driver.toolbarMgr.add(polyIcon, "idah-video:polygon", "selection", () => { driver.setMode("idah-video:polygon"); }, undefined, () => driver.mode === "idah-video:polygon");
    driver.toolbarMgr.add(noteIcon, "note", "selection", () => { driver.setMode("note"); }, undefined, () => driver.mode === "note");

    // Undo/redo (history group, shown in all modes)
    driver.toolbarMgr.add(undoIcon, "default", "history", () => driver.commandMgr.undo());
    driver.toolbarMgr.add(undoIcon, "idah-video:bounding-box", "history", () => driver.commandMgr.undo());
    driver.toolbarMgr.add(undoIcon, "idah-video:polygon", "history", () => driver.commandMgr.undo());
    driver.toolbarMgr.add(undoIcon, "note", "history", () => driver.commandMgr.undo());

    driver.toolbarMgr.add(redoIcon, "default", "history", () => driver.commandMgr.redo());
    driver.toolbarMgr.add(redoIcon, "idah-video:bounding-box", "history", () => driver.commandMgr.redo());
    driver.toolbarMgr.add(redoIcon, "idah-video:polygon", "history", () => driver.commandMgr.redo());
    driver.toolbarMgr.add(redoIcon, "note", "history", () => driver.commandMgr.redo());

    // Group order
    driver.toolbarMgr.orderGroups("default", ["selection", "history"]);
    driver.toolbarMgr.orderGroups("idah-video:bounding-box", ["selection", "history"]);
    driver.toolbarMgr.orderGroups("idah-video:polygon", ["selection", "history"]);
    driver.toolbarMgr.orderGroups("note", ["selection", "history"]);
  }

  function refreshToolbar() {
    toolbarItems = driver.toolbarMgr.getItemsForMode(driver.mode);
    currentMode = driver.mode;
  }

  // ── Listen to mode changes to refresh toolbar ────────────────────────
  driver.onModeChange(() => { refreshToolbar(); });

  // ── Mount the editor when the target element is ready ─────────────────
  $effect(() => {
    if (!targetElement) return;

    mountedPlugin = mount(IdahVideoPlugin, {
      target: targetElement,
      props: { context, driver },
    });

    return () => {
      if (mountedPlugin) {
        unmount(mountedPlugin);
        mountedPlugin = undefined;
      }
    };
  });

  // ── Init toolbar ──────────────────────────────────────────────────────
  registerMockToolbar();
  refreshToolbar();
</script>

<div class="mock-shell">
  <!-- V2 Toolbar — simulates the outer IDAH toolbar -->
  <IdahToolbar items={toolbarItems} />

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
