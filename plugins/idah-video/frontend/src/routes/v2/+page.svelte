<script lang="ts">
  // -----------------------------------------------------------------------
  // V2 Mock Page — Demonstrates the V2 IdahDriver in isolation
  // -----------------------------------------------------------------------
  import IdahToolbar from "./idah-toolbar.svelte";
  import { IdahDriverV2 } from "$idah/v2/idah-driver";
  import type { IToolbarItem, IAnnotationRecord, INoteRecord, ICommandAction } from "$idah/v2/types";

  // ── Create the driver ──────────────────────────────────────────────────
  const driver = new IdahDriverV2();

  // ── Reactive state bound to the driver ─────────────────────────────────
  let driverId = $state(driver.id);
  let driverMode = $state(driver.mode);
  let driverStatus = $state(driver.status);
  let driverMedia = $state(driver.media);

  // Ready state
  let ready = $state(false);
  driver.onReady(() => { ready = true; });

  // Sync state
  let syncQueued = $state(0);
  driver.onSyncChange((ev) => { syncQueued = ev.queued; });

  // Toolbar items
  let toolbarItems: IToolbarItem[] = $state([]);

  // Annotations / Notes listing
  let annotations: IAnnotationRecord[] = $state([]);
  let notes: INoteRecord[] = $state([]);

  // Command stack display
  let commandStack = $state<{ undo: { action: ICommandAction; timestamp: number }[]; redo: { action: ICommandAction; timestamp: number }[] }>({ undo: [], redo: [] });

  // Current filter input
  let filterInput = $state("");
  let filterField = $state("category");
  let filterOp = $state("eq");

  // ── Register some commands to showcase the system ──────────────────────

  // "annotation.add" — available in all modes
  driver.commandMgr.register(
    "annotation.add",
    ["default", "idah-video:bounding-box", "idah-video:polygon"],
    [null, "A"],
    "Add annotation",
    "Creates a new annotation at the current frame",
    () => ({
      command: { name: "annotation.add", modes: [], shortcut: null, shortDescription: null, longDescription: null },
      do() {
        const ann = driver.annotationStore.create({
          id: "",
          shape: { type: "idah-video:bounding-box", x: 50, y: 50, w: 30, h: 30 },
          label: "new",
          category: "unlabeled",
          frame: { start: 0, end: 30 },
        });
        console.log("[v2] annotation created:", ann.id);
        refreshAnnotations();
      },
      undo() {
        // Undo would need to track the created id
        console.log("[v2] undo annotation.add — not tracked yet");
      },
      isCombinable() { return false; },
      combine(p) { return p; },
    }),
  );

  // "annotation.delete" — available in bounding-box & polygon modes
  driver.commandMgr.register(
    "annotation.delete",
    ["idah-video:bounding-box", "idah-video:polygon"],
    [null, "Delete"],
    "Delete annotation",
    "Removes the selected annotation",
    () => ({
      command: { name: "annotation.delete", modes: [], shortcut: null, shortDescription: null, longDescription: null },
      do() { console.log("[v2] annotation.delete called"); },
      undo() {},
      isCombinable() { return false; },
      combine(p) { return p; },
    }),
  );

  // ── Register toolbar items ─────────────────────────────────────────────

  function registerDefaultToolbar(): void {
    // Icons as SVG strings
    const cursorIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/></svg>`;
    const rectIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
    const polyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L22 8.5V15.5L12 22L2 15.5V8.5L12 2z"/></svg>`;
    const noteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>`;
    const undoIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`;
    const redoIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>`;

    // ── Items for "default" mode ─────────────────────────────────────
    driver.toolbarMgr.add(
      cursorIcon, "default", "selection", () => {
        driver.setMode("default");
        refreshToolbar();
        refreshAnnotations();
      },
      () => true,
      () => driver.mode === "default",
    );

    // ── Items for "idah-video:bounding-box" mode ─────────────────────
    driver.toolbarMgr.add(
      rectIcon, "idah-video:bounding-box", "selection", () => {
        driver.setMode("idah-video:bounding-box");
        refreshToolbar();
      },
      () => true,
      () => driver.mode === "idah-video:bounding-box",
    );

    // ── Items for "idah-video:polygon" mode ──────────────────────────
    driver.toolbarMgr.add(
      polyIcon, "idah-video:polygon", "selection", () => {
        driver.setMode("idah-video:polygon");
        refreshToolbar();
      },
      () => true,
      () => driver.mode === "idah-video:polygon",
    );

    // ── Items for "note" mode ────────────────────────────────────────
    driver.toolbarMgr.add(
      noteIcon, "note", "selection", () => {
        driver.setMode("note");
        refreshToolbar();
      },
      () => true,
      () => driver.mode === "note",
    );

    // ── Undo / Redo for all modes ────────────────────────────────────
    driver.toolbarMgr.add(
      undoIcon, "default", "history", () => {
        driver.commandMgr.undo();
        refreshCommandStack();
      },
    );
    driver.toolbarMgr.add(
      undoIcon, "idah-video:bounding-box", "history", () => {
        driver.commandMgr.undo();
        refreshCommandStack();
      },
    );
    driver.toolbarMgr.add(
      undoIcon, "idah-video:polygon", "history", () => {
        driver.commandMgr.undo();
        refreshCommandStack();
      },
    );
    driver.toolbarMgr.add(
      redoIcon, "default", "history", () => {
        driver.commandMgr.redo();
        refreshCommandStack();
      },
    );
    driver.toolbarMgr.add(
      redoIcon, "idah-video:bounding-box", "history", () => {
        driver.commandMgr.redo();
        refreshCommandStack();
      },
    );
    driver.toolbarMgr.add(
      redoIcon, "idah-video:polygon", "history", () => {
        driver.commandMgr.redo();
        refreshCommandStack();
      },
    );

    // Set group order
    driver.toolbarMgr.orderGroups("default", ["selection", "history"]);
    driver.toolbarMgr.orderGroups("idah-video:bounding-box", ["selection", "history"]);
    driver.toolbarMgr.orderGroups("idah-video:polygon", ["selection", "history"]);
  }

  // ── Refresh helpers ────────────────────────────────────────────────────

  function refreshToolbar() {
    toolbarItems = driver.toolbarMgr.getItemsForMode(driver.mode);
  }

  function refreshAnnotations() {
    annotations = driver.annotationStore.fetch();
  }

  function refreshNotes() {
    notes = driver.noteStore.fetch();
  }

  function refreshCommandStack() {
    commandStack = {
      undo: driver.commandMgr.list(10).undo,
      redo: driver.commandMgr.list(10).redo,
    };
  }

  function refreshAll() {
    driverId = driver.id;
    driverMode = driver.mode;
    driverStatus = driver.status;
    driverMedia = driver.media;
    refreshToolbar();
    refreshAnnotations();
    refreshNotes();
    refreshCommandStack();
  }

  // ── Simulate a sync event ──────────────────────────────────────────────

  let syncInput = $state(0);

  function emitSync() {
    driver.notifySyncChange(syncInput);
  }

  // ── Annotation CRUD helpers in the page ────────────────────────────────

  let newAnnLabel = $state("");
  let newAnnCategory = $state("unlabeled");
  let selectedAnnotationId = $state<string | null>(null);
  let editLabel = $state("");

  async function createAnnotation() {
    await driver.annotations.create({
      id: "",
      shape: { type: "idah-video:bounding-box", x: 10, y: 10, w: 50, h: 40 },
      label: newAnnLabel || "auto-created",
      category: newAnnCategory,
      frame: { start: 0, end: 60 },
    });
    refreshAnnotations();
    newAnnLabel = "";
  }

  async function deleteAnnotation(id: string) {
    await driver.annotations.delete(id);
    refreshAnnotations();
  }

  async function updateAnnotation(id: string) {
    if (editLabel) {
      await driver.annotations.update(id, { label: editLabel } as Partial<IAnnotationRecord>);
      editLabel = "";
      refreshAnnotations();
    }
  }

  // ── Filtered fetch ────────────────────────────────────────────────────

  async function fetchFiltered() {
    const filter: Record<string, unknown> = {};
    if (filterInput) {
      if (filterOp === "eq") {
        filter[filterField] = filterInput;
      } else {
        filter[filterField] = { [filterOp]: isNaN(Number(filterInput)) ? filterInput : Number(filterInput) };
      }
    }
    annotations = await driver.annotations.fetch(filter as any);
  }

  async function fetchAll() {
    annotations = await driver.annotations.fetch();
    filterInput = "";
  }

  // ── Virtual field demo ────────────────────────────────────────────────

  let virtualDemoResult = $state("");

  function demoVirtualField() {
    // Register a virtual field that computes "frameSpan"
    driver.annotations.registerField("frameSpan", (ann) => {
      const f = ann.frame as { start?: number; end?: number } | undefined;
      if (f && f.start !== undefined && f.end !== undefined) {
        return f.end - f.start;
      }
      return undefined;
    });

    // Fetch with a filter on that virtual field
    driver.annotations.fetch({ frameSpan: { gte: 50 } }).then((result) => {
      virtualDemoResult = JSON.stringify(result, null, 2);
      annotations = result;
    });
  }

  // ── Note CRUD examples ─────────────────────────────────────────────────

  let newNoteContent = $state("");

  async function createNote() {
    if (!newNoteContent.trim()) return;
    await driver.notes.create({
      id: "",
      annotation_id: selectedAnnotationId,
      content: newNoteContent,
      resolved: false,
    });
    newNoteContent = "";
    refreshNotes();
  }

  async function deleteNote(id: string) {
    await driver.notes.delete(id);
    refreshNotes();
  }

  // ── Mode change listener ──────────────────────────────────────────────

  driver.onModeChange((ev) => {
    console.log(`[v2] mode changed: ${ev.oldValue} → ${ev.newValue}`);
    driverMode = driver.mode;
    refreshToolbar();
    refreshCommandStack();
  });

  // ── Init ───────────────────────────────────────────────────────────────

  registerDefaultToolbar();
  refreshAll();

  // Helper to show whether a command is active
  function getActiveCommandNames(): string {
    return driver.commandMgr.getActiveCommands().map((c) => c.name).join(", ");
  }
</script>

<div class="v2-page">
  <!-- ── Toolbar ───────────────────────────────────────────────────── -->
  <IdahToolbar items={toolbarItems} />

  <!-- ── Top bar: driver info ──────────────────────────────────────── -->
  <div class="top-bar">
    <div class="info-grid">
      <div><strong>ID:</strong> {driverId}</div>
      <div><strong>Mode:</strong> <span class="badge badge-mode">{driverMode}</span></div>
      <div><strong>Status:</strong> <span class="badge badge-status">{driverStatus}</span></div>
      <div><strong>Ready:</strong> <span class="badge" class:badge-ready={ready} class:badge-not-ready={!ready}>{ready ? "✅" : "⏳"}</span></div>
      <div><strong>Sync queued:</strong> {syncQueued}</div>
    </div>

    <div class="group-info">
      <strong>Active commands:</strong> {getActiveCommandNames()}
    </div>

    <div class="group-info">
      <strong>Media metadata:</strong> {JSON.stringify(driverMedia.metadata)}
    </div>
  </div>

  <!-- ── Sync simulation ────────────────────────────────────────────── -->
  <div class="section">
    <h3>🔄 Simulate Sync Event</h3>
    <input type="number" bind:value={syncInput} min="0" />
    <button onclick={emitSync}>Notify Sync Change</button>
  </div>

  <!-- ── Main content: two columns ──────────────────────────────────── -->
  <div class="main-content">
    <!-- Left: Annotations -->
    <div class="panel">
      <h3>📌 Annotations (annotations.fetch)</h3>

      <!-- Filter bar -->
      <div class="filter-bar">
        <select bind:value={filterField}>
          <option value="category">category</option>
          <option value="label">label</option>
          <option value="frameSpan">frameSpan (virtual)</option>
        </select>
        <select bind:value={filterOp}>
          <option value="eq">eq</option>
          <option value="gte">gte</option>
          <option value="gt">gt</option>
          <option value="lte">lte</option>
          <option value="lt">lt</option>
          <option value="neq">neq</option>
          <option value="in">in</option>
        </select>
        <input type="text" bind:value={filterInput} placeholder="filter value..." />
        <button onclick={fetchFiltered}>Apply Filter</button>
        <button onclick={fetchAll}>Clear Filter</button>
      </div>

      <!-- Create -->
      <div class="create-bar">
        <input type="text" bind:value={newAnnLabel} placeholder="label..." />
        <input type="text" bind:value={newAnnCategory} placeholder="category..." />
        <button onclick={createAnnotation}>+ Create Annotation</button>
      </div>

      <!-- List -->
      <div class="item-list">
        {#each annotations as ann (ann.id)}
          <div class="item" class:selected={selectedAnnotationId === ann.id}>
            <div class="item-header">
              <strong>{ann.label as string}</strong>
              <span class="tag">{ann.category as string}</span>
              <span class="id">({ann.id as string})</span>
            </div>
            <pre>{JSON.stringify(ann.shape, null, 2)}</pre>
            <div class="item-actions">
              <button onclick={() => { selectedAnnotationId = ann.id; editLabel = ann.label as string; }}>Edit</button>
              <button onclick={() => deleteAnnotation(ann.id)}>Delete</button>
              <button onclick={() => updateAnnotation(ann.id)}>Update Label</button>
            </div>
            {#if selectedAnnotationId === ann.id}
              <input type="text" bind:value={editLabel} placeholder="new label..." />
            {/if}
          </div>
        {/each}
      </div>

      <!-- Virtual field demo -->
      <div class="section">
        <h4>🧪 Virtual Field Demo</h4>
        <button onclick={demoVirtualField}>Fetch with frameSpan >= 50</button>
        {#if virtualDemoResult}
          <pre>{virtualDemoResult}</pre>
        {/if}
      </div>
    </div>

    <!-- Right: Notes + Command Stack -->
    <div class="panel">
      <!-- Notes -->
      <h3>💬 Notes</h3>
      <div class="create-bar">
        <input type="text" bind:value={newNoteContent} placeholder="note content..." />
        <button onclick={createNote}>+ Add Note</button>
      </div>
      <div class="item-list">
        {#each notes as note (note.id)}
          <div class="item">
            <div><strong>{note.annotation_id as string}</strong>: {note.content as string}</div>
            <div class="item-actions">
              <button onclick={() => deleteNote(note.id)}>Delete</button>
            </div>
          </div>
        {/each}
      </div>

      <hr />

      <!-- Command Stack -->
      <h3>📋 Command Stack</h3>
      <div class="stack-section">
        <div>
          <strong>Undo stack ({commandStack.undo.length})</strong>
          {#each commandStack.undo as entry}
            <div class="stack-entry">{entry.action.command.name} @ {new Date(entry.timestamp).toLocaleTimeString()}</div>
          {/each}
        </div>
        <div>
          <strong>Redo stack ({commandStack.redo.length})</strong>
          {#each commandStack.redo as entry}
            <div class="stack-entry">{entry.action.command.name} @ {new Date(entry.timestamp).toLocaleTimeString()}</div>
          {/each}
        </div>
      </div>

      <!-- Undo/Redo buttons -->
      <div class="create-bar">
        <button onclick={() => { driver.commandMgr.undo(); refreshCommandStack(); }}>↩ Undo</button>
        <button onclick={() => { driver.commandMgr.redo(); refreshCommandStack(); }}>↪ Redo</button>
        <button onclick={refreshCommandStack}>Refresh Stack</button>
      </div>

      <hr />

      <!-- Active commands list -->
      <h3>⚡ Active Commands</h3>
      <div class="item-list">
        {#each driver.commandMgr.getActiveCommands() as cmd}
          <div class="item">
            <strong>{cmd.name}</strong>
            <span class="tag">{cmd.modes.join(", ")}</span>
            {#if cmd.shortcut}
              <span class="tag shortcut">{[cmd.shortcut[0], cmd.shortcut[1]].filter(Boolean).join("+")}</span>
            {/if}
            {#if cmd.shortDescription}
              <div class="desc">{cmd.shortDescription}</div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .v2-page {
    font-family: system-ui, sans-serif;
    background: var(--background, #fff);
    color: var(--foreground, #212529);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .top-bar {
    padding: 8px 12px;
    background: #f1f3f5;
    border-bottom: 1px solid #dee2e6;
    font-size: 13px;
  }
  .info-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
  }
  .badge-mode {
    background: #d0ebff;
    color: #1c7ed6;
  }
  .badge-status {
    background: #d3f9d8;
    color: #2b8a3e;
  }
  .badge-ready {
    background: #d3f9d8;
  }
  .badge-not-ready {
    background: #fff3bf;
  }
  .group-info {
    margin-top: 4px;
  }
  .section {
    padding: 8px 12px;
    border-bottom: 1px solid #eee;
  }
  .section h3, .section h4 {
    margin: 0 0 6px;
    font-size: 14px;
  }
  .main-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    flex: 1;
  }
  .panel {
    padding: 12px;
    overflow-y: auto;
    border-right: 1px solid #dee2e6;
  }
  .panel:last-child {
    border-right: none;
  }
  .filter-bar, .create-bar {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  input, select {
    padding: 4px 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 13px;
  }
  button {
    padding: 4px 10px;
    border: 1px solid #adb5bd;
    border-radius: 4px;
    background: #f8f9fa;
    cursor: pointer;
    font-size: 13px;
  }
  button:hover {
    background: #e9ecef;
  }
  .item-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .item {
    padding: 8px;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    background: #fafafa;
  }
  .item.selected {
    border-color: #339af0;
    background: #e7f5ff;
  }
  .item-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tag {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 4px;
    background: #e9ecef;
    font-size: 11px;
  }
  .tag.shortcut {
    background: #fff3bf;
    color: #a0630c;
  }
  .id {
    color: #868e96;
    font-size: 11px;
  }
  .desc {
    font-size: 12px;
    color: #495057;
    margin-top: 2px;
  }
  .item-actions {
    display: flex;
    gap: 4px;
    margin-top: 4px;
    flex-wrap: wrap;
  }
  .item-actions button {
    font-size: 11px;
    padding: 2px 6px;
  }
  .stack-section {
    display: flex;
    gap: 12px;
  }
  .stack-entry {
    font-size: 12px;
    padding: 2px 0;
    color: #495057;
  }
  hr {
    margin: 12px 0;
    border: none;
    border-top: 1px solid #dee2e6;
  }
  pre {
    font-size: 11px;
    background: #f1f3f5;
    padding: 4px;
    border-radius: 4px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
