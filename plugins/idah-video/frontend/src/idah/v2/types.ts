// ---------------------------------------------------------------------------
// V2 Driver — Type definitions
// ---------------------------------------------------------------------------

/**
 * A keyboard shortcut expressed as a canonical key-combination string.
 *
 * Format: `"ModifierA+ModifierB+Key"` where modifiers are sorted alphabetically.
 * When there are no modifiers, it's just the key name.
 *
 * Examples:
 *   - `"Delete"`
 *   - `"Control+Z"`
 *   - `"Control+Shift+Z"`
 *   - `"Control+Alt+ArrowRight"`
 *   - `"B"`
 *
 * Modifier names (matching KeyboardEvent properties):
 *   `"Alt"`, `"Control"`, `"Meta"`, `"Shift"`
 *
 * Key names use `KeyboardEvent.code` for non-letter keys
 * (`"Space"`, `"ArrowRight"`, `"Delete"`, …) and the uppercase letter
 * for letter keys (`"A"`, `"B"`, …).
 */
export type IShortcut = string;

// ─── Media ────────────────────────────────────────────────────────────────

export interface IMediaInfo {
  id: string;
  resource: string;
  key: string;
  mime_type: string;
  filename: string;
  meta: Record<string, unknown>;
  /** Optional explicit URL (overrides the auto-generated path from resource/key). */
  url?: string;
}

// ─── Sync event ───────────────────────────────────────────────────────────

export interface ISyncEvent {
  /** Number of operations still queued to sync with the backend. */
  queued: number;
}

// ─── Sync error event ────────────────────────────────────────────────────

export interface ISyncErrorEvent {
  /** Human-readable error message. */
  message: string;
  /** Optional error code for programmatic handling. */
  code?: string;
  /** Number of operations that failed and could not be retried. */
  failedCount?: number;
}

// ─── Mode change event ────────────────────────────────────────────────────

export interface IModeEvent {
  oldValue: string;
  newValue: string;
}

// ─── Commands ─────────────────────────────────────────────────────────────

/** Describes a registered command (meta-info returned by `getActiveCommands`). */
export interface ICommandDescriptor {
  /** Unique name of the command. */
  name: string;
  /** Group/category label for organising commands in the palette (e.g. "Viewport", "Selection"). */
  group?: string;
  /** Modes in which this command is available. */
  modes: string[];
  /** Optional keyboard shortcut — a canonical key-combination string. */
  shortcut: IShortcut | null;
  /** One-line description. */
  shortDescription: string | null;
  /** Long description. */
  longDescription: string | null;
  /**
   * Optional predicate: when present, the command is only considered active
   * (e.g. for shortcut execution or palette display) if this returns true.
   * For the palette, it's only evaluated when the current mode matches.
   */
  activeWhen?: () => boolean;
}

/** The action returned by a command callback. */
export interface ICommandAction {
  /** The command descriptor that produced this action. */
  readonly command: ICommandDescriptor;

  /** Perform the action. */
  do(): void;
  /** Revert the action (optional — if missing, won't be stacked). */
  undo?(): void;
  /** Whether this action can be combined with `previous`. */
  isCombinable(previous: ICommandAction): boolean;
  /** Combine with `previous` and return the merged action. */
  combine(previous: ICommandAction): ICommandAction;
}

/** Stack entry used internally by the command manager. */
export interface ICommandStackEntry {
  action: ICommandAction;
  timestamp: number;
}

// ─── Config (label schema) ───────────────────────────────────────────────

/**
 * A label value definition in the project config.
 * Mirrors the V1 `IConfigValue`.
 */
export interface IConfigValue {
  id: string;
  label: string;
  color: string | null;
  text_color: string | null;
  description?: string;
}

/** Supported property types. */
export type IConfigPropertyType = "text" | "integer" | "boolean" | "single-select" | "multi-select";

/** A single option inside a select property. */
export interface IConfigPropertyOption {
  id: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  styles?: Record<string, any>;
}

/** Format constraints for a property. */
export interface IConfigPropertyFormat {
  minimum?: number;
  maximum?: number;
  step?: number;
  info?: string;
  options?: IConfigPropertyOption[];
}

/** A property definition for a shape type. */
export interface IConfigProperty {
  id: string;
  label: string;
  description: string;
  type: IConfigPropertyType;
  required: boolean;
  visibility: boolean | [string, (string | number | boolean | string[])[]];
  format: IConfigPropertyFormat;
}

/** Shape config for a single shape type (values + properties). */
export interface IShapeConfig {
  values: IConfigValue[];
  properties: IConfigProperty[];
}

/**
 * Project configuration: maps shape types (e.g. "idah-video:bounding-box")
 * to their label lists and property schemas.
 */
export interface IConfig {
  [shape_type: string]: IShapeConfig;
}

// ─── AST (conditional visibility) ────────────────────────────────────────

export type ASTValue = string | number | string[] | boolean | undefined;
export type ASTNodeValue = ASTValue | ASTNode | [ASTValue];
export type ASTNode = [string, ASTNodeValue[]];

// ─── Toolbar ──────────────────────────────────────────────────────────────

export interface IToolbarItem {
  /** Raw HTML/SVG string for the icon. */
  icon: string;
  /** Label for tooltips. */
  label: string;
  /** The mode this item belongs to (e.g. "default", "idah-video:bounding-box"). */
  mode: string;
  /** Optional group name (items in the same group are rendered together; `null` => always first). */
  group: string | null;
  /** Click handler. */
  onClick: Unsubscribe;
  /**
   * Optional command name for shortcut lookup.
   * If provided, the toolbar item's shortcut will be fetched from the command registry.
   */
  name?: string;
  /**
   * Predicate — toolbar hides the item when `visibleWhen` returns `false`.
   * Default: always true.
   */
  visibleWhen?: () => boolean;
  /**
   * Predicate — when true the item is rendered in a "pressed" (active) state.
   * Default: false.
   */
  whenToggled?: () => boolean;
}

// ─── Annotation / Notes ───────────────────────────────────────────────────

/** Operators for filter values. */
export interface IRangeOp {
  gte?: string | number;
  gt?: string | number;
  lte?: string | number;
  lt?: string | number;
  eq?: string | number;
  neq?: string | number;
}

export type IFilterValue = string | number | IRangeOp | { in: (string | number)[] };

export interface IFilter {
  [field: string]: IFilterValue;
}

// ─── Annotation metadata ────────────────────────────────────────────────

/**
 * Annotation metadata — flat wrapper for the DB `metadata` JSONB column.
 *
 * Annotations sharing the same `group_id` are rendered as a single track
 * in the timeline. When absent, the annotation's own `id` is used as fallback.
 */
export interface IAnnotationMetadata {
  group_id?: string;
  parent_id?: string;
  [key: string]: unknown;
}

// ─── Annotation value ──────────────────────────────────────────────────

/**
 * Base annotation value payload (maps to DB `annotation` JSONB column).
 * This is a generic base; specific modalities extend it
 * (e.g. IVideoAnnotationValue for video).
 */
export interface IAnnotationValue {
  [key: string]: unknown;
}

// ─── Annotation record ─────────────────────────────────────────────────

/**
 * A raw annotation record as stored and returned by the driver.
 *
 * Generic over two type parameters to mirror the DB structure:
 * - `Shape`      – the `dimensions` JSONB column (polygon, bbox, …)
 * - `Annotation` – the `annotation` JSONB column (category, label, attributes, …)
 */
export interface IAnnotationRecord<Shape = Record<string, unknown>, Annotation = Record<string, unknown>> {
  id: string;

  /**
   * Shape geometry — corresponds to the DB `dimensions` JSONB column.
   * Type-specific (e.g. IVideoAnnotationShape for video).
   */
  shape: Shape;

  /**
   * The annotation payload — corresponds to the DB `annotation` JSONB column.
   * Contains category, label, attributes, etc.
   */
  value?: Annotation;

  /**
   * Annotation metadata — corresponds to the DB `metadata` JSONB column.
   */
  metadata?: IAnnotationMetadata;

  created_by_id?: string;
  created_at?: string;
  updated_at?: string;

  /** Allow extensibility. */
  [key: string]: unknown;
}

// ─── Note record ─────────────────────────────────────────────────────────

/**
 * Note anchor — describes what the note is attached to and where.
 * The `position` field is plugin-opaque; the core stores and forwards it as-is.
 */
export interface INoteAnchor {
  /** Where the note is anchored: to the entry or to a specific annotation. */
  anchor_type: "entry" | "annotation";

  /** The annotation this note is attached to, or null for entry-level notes. */
  annotation_id?: string | null;

  /**
   * Plugin-opaque position data. Core stores and forwards as-is.
   * - annotation anchor: normalised offset from annotation centroid
   * - entry anchor: plugin-defined (frame + normalised coords, etc.)
   * Maps directly to the `position` JSONB column — no backend changes needed.
   */
  position?: unknown;
}

/**
 * Screen position reported by the plugin for overlay placement.
 * Uses plugin-container-relative pixels.
 * `x`/`y` are undefined when the note is out of context — hide overlay without deselecting.
 * `noteId` is null when reporting position for a pending creation.
 */
export interface INoteScreenPosition {
  noteId: string | null;
  x?: number;
  y?: number;
}

/**
 * A note record as transmitted between core and plugin.
 * All spatial/temporal position info lives inside the opaque `anchor.position`.
 */
export interface INoteRecord {
  id: string;

  /** The anchor — what and where this note is attached to. */
  anchor: INoteAnchor;

  /** Markdown content of the note. */
  content_md?: string;

  /** Whether the note thread is resolved. */
  resolved?: boolean;

  /** Whether the note is pending or resolved. */
  status?: "pending" | "resolved";

  created_by_email?: string;
  created_at?: string;
  updated_at?: string;
  edited_at?: string | null;

  /** Allow extensibility. */
  [key: string]: unknown;
}

// ─── V2 Driver — Annotations submodule ────────────────────────────────────

export interface IAnnotationsDriverV2<Shape = Record<string, unknown>, Annotation = Record<string, unknown>> {
  /**
   * Register a virtual (computed) field. The callback receives the raw annotation
   * and returns the computed value. Virtual fields can be used in filters.
   */
  registerField(name: string, fn: (ann: IAnnotationRecord<Shape, Annotation>) => unknown): void;

  /** Fetch annotations, optionally filtered. */
  fetch(filter?: IFilter): Promise<IAnnotationRecord<Shape, Annotation>[]>;

  /** Update a single annotation. */
  update(id: string, data: Partial<IAnnotationRecord<Shape, Annotation>>): Promise<void>;

  /** Delete a single annotation. */
  delete(id: string): Promise<void>;

  /** Create a new annotation (id is auto-generated via uuidv7). */
  create(data: IAnnotationRecord<Shape, Annotation>): Promise<IAnnotationRecord<Shape, Annotation>>;
}

// ─── V2 Driver — Notes submodule ──────────────────────────────────────────

/**
 * Push-based observer interface for notes.
 * The core owns all note data; the plugin owns the viewport.
 * The plugin receives notes, displays markers, and reports screen positions back.
 * It never reads or writes note data directly.
 */
export interface INotesDriverV2 {
  // ── Core → Plugin (observers) ──────────────────────────────────────────

  /**
   * Fires immediately on registration with the current note list,
   * then again on any change (create / update / delete).
   * The plugin uses this to seed and maintain its local store.
   */
  onNotesChange(cb: (notes: INoteRecord[]) => void): Unsubscribe;

  /**
   * Fires when the core wants the plugin to navigate to a note.
   * The plugin should seek to the note's anchor position and then
   * call `reportNotePosition` once the viewport has settled.
   */
  onFocusNote(cb: (note: INoteRecord) => void): Unsubscribe;

  // ── Plugin → Core (commands) ───────────────────────────────────────────

  /**
   * Report the screen position of a marker for overlay placement.
   * `noteId` is null when reporting position for a pending creation.
   * `x`/`y` are undefined when the note is out of context — signals
   * the core to hide the overlay without deselecting the note.
   */
  reportNotePosition(position: INoteScreenPosition): void;

  /**
   * Called when the user clicks a marker in the plugin viewport.
   * Pass `null` to deselect.
   */
  selectNote(noteId: string | null): void;

  /**
   * Called when the user clicks in the viewport with the note tool active.
   * The anchor describes what the new note should be attached to.
   */
  requestCreateNote(anchor: INoteAnchor): void;
}

// ─── V2 Driver — Command submodule ────────────────────────────────────────

export interface ICommandDriverV2 {
  /**
   * Register a command.
   * @param name      Unique command name.
   * @param modes     Array of mode names where this command is active.
   * @param shortcut  Optional keyboard shortcut — a canonical key-combination string
   *                  (e.g. `"Control+Z"`, `"Delete"`, `"Control+Shift+Z"`).
   * @param shortDesc Short description (displayed in menus).
   * @param longDesc  Long description.
   * @param callback  Factory that returns an ICommandAction when called.
   * @param group     Optional group/category label for the palette.
   * @param activeWhen Optional predicate: only active when returns true.
   *                   Evaluated for shortcuts and palette visibility.
   * @throws If a command with the same name is already registered.
   */
  register(opts: {
    name: string;
    modes: string[];
    shortcut: IShortcut | null;
    shortDescription: string | null;
    longDescription: string | null;
    callback: (opts?: Record<string, unknown>) => ICommandAction;
    group?: string;
    activeWhen?: () => boolean;
  }): void;

  /** Execute a registered command by name. Adds it to the undo stack if `undo` is present. */
  call(name: string, ...opts: Record<string, unknown>[]): void;

  /** Undo the last `count` commands (default 1). Returns true if anything was undone. */
  undo(count?: number): boolean;

  /** Redo the last `count` commands (default 1). Returns true if anything was redone. */
  redo(count?: number): boolean;

  /** Return the current undo / redo stacks (each up to `n` entries). */
  history(n?: number): { undo: ICommandStackEntry[]; redo: ICommandStackEntry[] };

  /** Return commands whose mode list includes the current mode. */
  getActiveCommands(): ICommandDescriptor[];

  /** Return a single command descriptor by name, or undefined if not found. */
  getCommand(name: string): ICommandDescriptor | undefined;

  /**
   * Return the human-readable shortcut label for a command name, or undefined
   * if the command has no shortcut or doesn't exist.
   */
  getShortcut(name: string): string | undefined;

  /**
   * Return ALL registered commands grouped by their `group` field,
   * regardless of mode or shortcut. Commands without a group are placed
   * under "General". Used by the command palette to display every available
   * command.
   *
   * @param currentMode When provided, only commands matching this mode
   *                    (and passing activeWhen) are returned.
   */
  getAllCommands(currentMode?: string): Map<string, ICommandDescriptor[]>;

  /** Whether the command palette dialog is currently open. */
  isPaletteOpen(): boolean;

  /** Open or close the command palette. Omit value to toggle. */
  openPalette(open?: boolean): void;

  /** Whether there are actions to undo. */
  canUndo(): boolean;

  /** Whether there are actions to redo. */
  canRedo(): boolean;

  /** Listen for palette open/close changes. Returns unsubscribe function. */
  onPaletteChange(cb: (open: boolean) => void): () => void;

  // ── Keyboard resolution ────────────────────────────────────────────────

  /**
   * Resolve a KeyboardEvent against the registered shortcuts for a given mode.
   * If a matching command is found, it is executed via `call()`.
   * Returns `true` if a shortcut was matched (event should be consumed),
   * `false` otherwise.
   */
  resolveKeyEvent(event: KeyboardEvent, mode: string): boolean;

  /**
   * Return the flat key-combination → command name map for a given mode.
   * This is what the keyboard handler uses for O(1) event dispatch.
   *
   * Example return value:
   * ```json
   * {
   *   "Control+Z": "undo",
   *   "Control+Shift+Z": "redo",
   *   "Space": "viewport.play",
   *   "Delete": "selection.delete"
   * }
   * ```
   */
  getKeyMapForMode(mode: string): Record<string, string>;

  /**
   * Return a consolidated reference list of all registered shortcuts
   * across all modes, for use in the command palette.
   * Same shape as `IActivityContext.shortcutReferences`.
   */
  getShortcutReferences(): Record<string, { label: string; description: string; keyCombinations: string[] }>;
}

// ─── V2 Driver — Toolbar submodule ────────────────────────────────────────

export interface ToolbarItemOptions {
  /** Raw HTML/SVG string for the icon. */
  icon: string;
  /** Label for tooltips. */
  label: string;
  /**
   * One or more modes this item belongs to.
   * The item will be visible in any matching mode.
   */
  modes: string | string[];
  /** Optional group name (items in the same group render together; `null` => always first). */
  group: string | null;
  /** Click handler. */
  onClick: Unsubscribe;
  /**
   * Optional command name for shortcut lookup.
   * If provided, the toolbar item's shortcut will be fetched from the command registry.
   */
  name?: string;
  /**
   * Optional predicate — when returns `false`, the item is hidden.
   * Default: always visible.
   */
  visibleWhen?: () => boolean;
  /**
   * Optional predicate — when `true` the item renders in a "pressed" (active) state.
   * Default: `false`.
   */
  whenToggled?: () => boolean;
}

export interface IToolbarDriverV2 {
  /**
   * Add a toolbar item using a descriptor object.
   */
  add(options: ToolbarItemOptions): void;

  /** Define the display order of groups for a given mode. */
  orderGroups(mode: string, groups: string[]): void;
}

// ─── V2 Driver — Complete interface ──────────────────────────────────────

export interface IIdahDriverV2<Shape = Record<string, unknown>, Annotation = Record<string, unknown>> {
  // ── Activity context ──────────────────────────────────────────────────
  readonly id: string;
  readonly media: IMediaInfo;
  readonly workflowStep: string;
  readonly mode: string;

  setMode(mode: string): void;
  onModeChange(cb: (event: IModeEvent) => void): Unsubscribe;

  // ── Lifecycle callbacks ───────────────────────────────────────────────
  onReady(cb: () => void): void;
  onSyncChange(cb: (event: ISyncEvent) => void): Unsubscribe;
  onSyncError(cb: (event: ISyncErrorEvent) => void): Unsubscribe;

  // ── Project label config ─────────────────────────────────────────────
  readonly config: IConfig;

  /**
   * Returns the config for a shape type with properties already filtered
   * by visibility rules against the given value.
   */
  getFilteredConfig(shapeType: string, value: Record<string, unknown>): IShapeConfig | undefined;

  // ── Sub-modules ───────────────────────────────────────────────────────
  readonly command: ICommandDriverV2;
  readonly toolbar: IToolbarDriverV2;
  readonly annotations: IAnnotationsDriverV2<Shape, Annotation>;
  readonly notes: INotesDriverV2;

  // ── Keyboard dispatch ──────────────────────────────────────────────────

  /**
   * Top-level keyboard event dispatcher.
   * Delegates to `command.resolveKeyEvent()` using the current mode.
   * The Svelte component should call this from its `keydown` handler.
   * Returns `true` if the event was handled (caller should `preventDefault`).
   */
  handleKeydown(event: KeyboardEvent): boolean;
}

// ─── Utility ──────────────────────────────────────────────────────────────

export type Unsubscribe = () => void;
