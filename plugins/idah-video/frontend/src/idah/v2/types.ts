// ---------------------------------------------------------------------------
// V2 Driver — Type definitions
// ---------------------------------------------------------------------------

/** A keyboard shortcut described as [modifier | null, character]. */
export type IShortcut = [string | null, string];

// ─── Media ────────────────────────────────────────────────────────────────

export interface IMediaInfo {
  id: string;
  metadata: Record<string, unknown>;
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
  /** Modes in which this command is available. */
  modes: string[];
  /** Optional keyboard shortcut. */
  shortcut: IShortcut | null;
  /** One-line description. */
  shortDescription: string | null;
  /** Long description. */
  longDescription: string | null;
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

/**
 * Per-shape-type configuration: what labels (values) and properties
 * are available for annotations of that shape type.
 */
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

// ─── Annotation record ─────────────────────────────────────────────────

/**
 * Frame range for an annotation.
 */
export interface IAnnotationFrame {
  start: number;
  end: number;
}

/**
 * A single keyframe selection within an annotation's shape.
 */
export interface IVideoFrameSelection {
  frame: number;
  angle: number;
  points: [number, number][];
}

/**
 * A raw annotation record as stored and returned by the driver.
 */
export interface IAnnotationRecord {
  id: string;

  /** Shape geometry + frame range (start/end/frames etc.). */
  shape: {
    type: string;
    start: number;
    end: number;
    frames?: IVideoFrameSelection[];
    /** Bounding-box or polygon points, etc. */
    [key: string]: unknown;
  };

  /** Human-readable label (e.g. "car", "bus"). */
  label?: string;

  /** Category path (e.g. "vehicles/car"). */
  category?: string;

  /**
   * Flat frame-range object, separate from `shape.start`/`shape.end`.
   * Used by the filter system (e.g. `frame.start: { gte: ... }`).
   */
  frame?: IAnnotationFrame;

  /** Arbitrary metadata attached to the annotation. */
  metadata?: Record<string, unknown>;

  created_by_id?: string;
  created_at?: Date;
  updated_at?: Date;

  /** Allow extensibility. */
  [key: string]: unknown;
}

// ─── Note record ─────────────────────────────────────────────────────────

/**
 * A raw note record as stored and returned by the driver.
 * Mirrors the V1 INoteFeed / INoteComment shapes.
 */
export interface INoteRecord {
  id: string;

  /** The annotation this note is attached to, or null for entry-level notes. */
  annotation_id: string | null;

  /** Markdown content of the note. */
  content_md?: string;

  /** Whether the note thread is resolved. */
  resolved?: boolean;

  /** Whether the note is pending or resolved. */
  status?: "pending" | "resolved";

  /** Where the note is anchored. */
  anchor_type?: "entry" | "annotation";

  /** Viewport position of the note. */
  position?: Record<string, unknown>;

  created_by_email?: string;
  created_at?: string;
  updated_at?: string;
  edited_at?: string | null;

  /** Allow extensibility. */
  [key: string]: unknown;
}

// ─── V2 Driver — Annotations submodule ────────────────────────────────────

export interface IAnnotationsDriverV2 {
  /**
   * Register a virtual (computed) field. The callback receives the raw annotation
   * and returns the computed value. Virtual fields can be used in filters.
   */
  registerField(name: string, fn: (ann: IAnnotationRecord) => unknown): void;

  /** Fetch annotations, optionally filtered. */
  fetch(filter?: IFilter): Promise<IAnnotationRecord[]>;

  /** Update a single annotation. */
  update(id: string, data: Partial<IAnnotationRecord>): Promise<void>;

  /** Delete a single annotation. */
  delete(id: string): Promise<void>;

  /** Create a new annotation (id is auto-generated via uuidv7). */
  create(data: IAnnotationRecord): Promise<IAnnotationRecord>;
}

// ─── V2 Driver — Notes submodule ──────────────────────────────────────────

export interface INotesDriverV2 {
  registerField(name: string, fn: (note: INoteRecord) => unknown): void;
  fetch(filter?: IFilter): Promise<INoteRecord[]>;
  update(id: string, data: Partial<INoteRecord>): Promise<void>;
  delete(id: string): Promise<void>;
  create(data: INoteRecord): Promise<INoteRecord>;
}

// ─── V2 Driver — Command submodule ────────────────────────────────────────

export interface ICommandDriverV2 {
  /**
   * Register a command.
   * @param name      Unique command name.
   * @param modes     Array of mode names where this command is active.
   * @param shortcut  Optional keyboard shortcut [modifier, key].
   * @param shortDesc Short description (displayed in menus).
   * @param longDesc  Long description.
   * @param callback  Factory that returns an ICommandAction when called.
   * @throws If a command with the same name is already registered.
   */
  register(
    name: string,
    modes: string[],
    shortcut: IShortcut | null,
    shortDescription: string | null,
    longDescription: string | null,
    callback: (opts?: Record<string, unknown>) => ICommandAction,
  ): void;

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

export interface IIdahDriverV2 {
  // ── Activity context ──────────────────────────────────────────────────
  readonly id: string;
  readonly media: IMediaInfo;
  readonly status: string;
  readonly mode: string;

  setMode(mode: string): void;
  onModeChange(cb: (event: IModeEvent) => void): Unsubscribe;

  // ── Lifecycle callbacks ───────────────────────────────────────────────
  onReady(cb: () => void): void;
  onSyncChange(cb: (event: ISyncEvent) => void): Unsubscribe;
  onSyncError(cb: (event: ISyncErrorEvent) => void): Unsubscribe;

  // ── Project label config ─────────────────────────────────────────────
  readonly config: IConfig;

  // ── Sub-modules ───────────────────────────────────────────────────────
  readonly command: ICommandDriverV2;
  readonly toolbar: IToolbarDriverV2;
  readonly annotations: IAnnotationsDriverV2;
  readonly notes: INotesDriverV2;
}

// ─── Utility ──────────────────────────────────────────────────────────────

export type Unsubscribe = () => void;
