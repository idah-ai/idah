// ---------------------------------------------------------------------------
// Bridge: IdahDriverV2 → V1 IActivityContext
//
// This adapter allows the existing VideoAnnotationActivity (which speaks V1's
// IActivityContext) to run on top of the V2 driver.
// ---------------------------------------------------------------------------
import type {
  IActivityContext,
  IMedia,
  IConfig,
  IAnnotationDriver,
  IAnnotation,
  INotes,
  ICommands,
  ITools,
  IIconDriver,
  IWorkflowStep,
  IEntryStatus,
  HeaderBarModeTool,
  ICommand,
} from "$idah/context/activity-context";
import type { AnnotationShape } from "$idah/context/annotation-context";
import type { Hash } from "$idah/utils/types";

// IUser is not exported from the V1 context, define it locally
interface IUser {
  id: number;
  email: string;
  name: string;
  pictureUrl: string;
}
import type { IdahDriverV2 } from "$idah/v2/idah-driver";
import type { ICommandAction, ICommandDescriptor } from "$idah/v2/types";
import type { IVideoAnnotationRecord } from "$idah/v2/video-types";
import { data, type AnnotationItem, type NoteItem } from "$lib/state/data.svelte";

// ─── Sample config (needed by the editor) ────────────────────────────────

const SAMPLE_CONFIG: IConfig = {
  "idah-video:bounding-box": {
    values: [
      { id: "vehicles/car", color: "#F6402B", label: "Car", text_color: "#FFFFFF", description: "A car" },
      { id: "vehicles/bus", color: "#EB1461", label: "Bus", text_color: "#FFFFFF", description: "A bus" },
      { id: "vehicles/van", color: "#9C1AB2", label: "Van", text_color: "#FFFFFF", description: "A van" },
      { id: "vehicles/truck", color: "#FF8C00", label: "Truck", text_color: "#FFFFFF", description: "A truck" },
      { id: "person", color: "#1464EB", label: "Person", text_color: "#FFFFFF", description: "A person" },
      { id: "cyclist", color: "#00C853", label: "Cyclist", text_color: "#FFFFFF", description: "A cyclist" },
    ],
    properties: [
      {
        id: "wheels",
        type: "integer",
        label: "Number of wheels",
        format: { minimum: 0, maximum: 24, step: 1 },
        required: true,
        visibility: true,
        description: "How many wheels does the object have?",
      },
      {
        id: "color",
        type: "single-select",
        label: "Color",
        format: {
          options: [
            { id: "red", label: "Red" },
            { id: "blue", label: "Blue" },
            { id: "white", label: "White" },
            { id: "black", label: "Black" },
            { id: "silver", label: "Silver" },
          ],
        },
        required: false,
        visibility: true,
        description: "Primary color of the object",
      },
    ],
  },
  "idah-video:polygon": {
    values: [
      { id: "road-sign", color: "#FFD600", label: "Road Sign", text_color: "#000000", description: "A road sign" },
      { id: "traffic-light", color: "#FF6D00", label: "Traffic Light", text_color: "#FFFFFF", description: "A traffic light" },
      { id: "pedestrian", color: "#AA00FF", label: "Pedestrian", text_color: "#FFFFFF", description: "A pedestrian" },
    ],
    properties: [
      {
        id: "occluded",
        type: "boolean",
        label: "Occluded",
        format: {},
        required: true,
        visibility: true,
        description: "Is the object occluded?",
      },
    ],
  },
};

// ─── Bridge ──────────────────────────────────────────────────────────────

export function createV1Bridge(driver: IdahDriverV2): IActivityContext {
  // Lazy accessor: data.annotations is initialised after the driver is set up,
  // so we must read it lazily inside each method rather than capturing at module scope.
  function getAnnotations() {
    if (!data.annotations) throw new Error("data.annotations not initialised");
    return data.annotations;
  }
  // ── V2 → V1 annotation mapper ───────────────────────────────────────
  function toV1Annotation(rec: Record<string, unknown>): IAnnotation {
    const shape = rec.shape as Record<string, unknown> | undefined;
    const value = rec.value as Record<string, unknown> | undefined;
    const meta = rec.metadata as Record<string, unknown> | undefined;
    return {
      id: rec.id as string,
      dimensions: (shape ?? { type: "unknown" }) as AnnotationShape,
      annotation: {
        category: (value?.category as string) ?? "unlabeled",
        attributes: (value?.attributes as Record<string, unknown>) ?? {},
      },
      metadata: meta,
      created_by_id: rec.created_by_id as string | undefined,
      created_at: rec.created_at as Date | undefined,
      updated_at: rec.updated_at as Date | undefined,
    };
  }

  // ── V2 → V1 annotation driver ─────────────────────────────────────
  const annotationDriver: IAnnotationDriver = {
    async create(id: string, dimension: any, annotation: any, metadata?: any): Promise<IAnnotation> {
      const record = await driver.annotations.create({
        id: "",
        shape: dimension,
        annotation,
        metadata,
        created_by_id: "1",
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      return toV1Annotation(record);
    },
    async update(ann: IAnnotation): Promise<void> {
      await driver.annotations.update(ann.id, {
        shape: ann.dimensions,
        annotation: ann.annotation,
        metadata: ann.metadata,
      } as any);
    },
    async delete(id: string): Promise<void> {
      await driver.annotations.delete(id);
    },
    async list(_filter: any, _pagination: any): Promise<IAnnotation[]> {
      return getAnnotations().items.map(toV1Annotation);
    },
    flush() {
      // no-op in-memory
    },
  };

  // ── Notes adapter ──────────────────────────────────────────────────
  const notesDriver: INotes = {
    showNewNoteFeedPopup() {},
    onNewNoteFeedOpenChange() {},
    requireNoteFeedPosition() {},
    onRequireNoteFeedPosition() {},
    gotoFeed() {},
    onNoteSelected() {},  };

  // ── Icon driver ───────────────────────────────────────────────────
  const iconDriver: IIconDriver = {
    async get(iconName: string) {
      const icons: Record<string, string> = {
        "mouse-pointer-2": `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/></svg>`,
        "vector-square": `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19.5 7a24 24 0 0 1 0 10"/><path d="M4.5 7a24 24 0 0 0 0 10"/><path d="M7 19.5a24 24 0 0 0 10 0"/><path d="M7 4.5a24 24 0 0 1 10 0"/><rect x="17" y="17" width="5" height="5" rx="1"/><rect x="17" y="2" width="5" height="5" rx="1"/><rect x="2" y="17" width="5" height="5" rx="1"/><rect x="2" y="2" width="5" height="5" rx="1"/></svg>`,
        polygon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 6L13 7M16 10L18 16M16 18L10.5 17M7.5 13L6 8M8 5.5C8 6.88071 6.88071 8 5.5 8C4.11929 8 3 6.88071 3 5.5C3 4.11929 4.11929 3 5.5 3C6.88071 3 8 4.11929 8 5.5ZM11 15.5C11 16.8807 9.88071 18 8.5 18C7.11929 18 6 16.8807 6 15.5C6 14.1193 7.11929 13 8.5 13C9.88071 13 11 14.1193 11 15.5ZM18 7.5C18 8.88071 16.8807 10 15.5 10C14.1193 10 13 8.88071 13 7.5C13 6.11929 14.1193 5 15.5 5C16.8807 5 18 6.11929 18 7.5ZM21 18.5C21 19.8807 19.8807 21 18.5 21C17.1193 21 16 19.8807 16 18.5C16 17.1193 17.1193 16 18.5 16C19.8807 16 21 17.1193 21 18.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        "message-circle": `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>`,
      };
      return icons[iconName] ?? "";
    },
  };

  // ── Commands bridge ───────────────────────────────────────────────
  let shortcutRefs: Record<string, { label: string; description: string; keyCombinations: string[] }> | undefined;

  const commandBridge: ICommands = {
    on<T>(name: string, builder: (props: T) => ICommand | void | Promise<ICommand | void>, manager = true) {
      const cb = () => {
        const cmd = builder({} as T) as ICommand | void;
        if (!cmd) return noopAction(name);
        return makeActionFromV1Command(cmd, name);
      };
      try {
        driver.commandMgr.register(name, ["default", "idah-video:bounding-box", "idah-video:polygon", "note"], null, null, null, cb);
      } catch {
        // Allow re-registration from the bridge
      }
    },
    async run<T>(name: string, props?: T) {
      const cb = driver.commandMgr.getCallback(name);
      if (cb) {
        driver.commandMgr.call(name, props as Record<string, unknown>);
        return;
      }
      console.warn(`[bridge] command not found: ${name}`);
    },
    undo(times?: number) {
      driver.commandMgr.undo(times);
    },
    redo(times?: number) {
      driver.commandMgr.redo(times);
    },
  };

  function noopAction(name: string): ICommandAction {
    return {
      command: { name, modes: [], shortcut: null, shortDescription: null, longDescription: null },
      do() {},
      isCombinable() { return false; },
      combine(p: ICommandAction) { return p; },
    };
  }

  function makeActionFromV1Command(cmd: ICommand, name: string): ICommandAction {
    return {
      command: { name, modes: [], shortcut: null, shortDescription: null, longDescription: null },
      do() { cmd.apply(); },
      undo() { cmd.undo(); },
      isCombinable() { return cmd.isCombinable?.(cmd) ?? false; },
      combine(prev: ICommandAction) {
        cmd.combine?.(cmd);
        return this;
      },
    };
  }

  // ── Tools bridge ──────────────────────────────────────────────────
  const toolsBridge: ITools = {
    setTools(_tools: HeaderBarModeTool[]) {},
    setTool(_tool: string) {},
    onToolsChange() {},
    onToolChange() {},
  };

  // ── Return the complete context ──────────────────────────────────
  return {
    get id() { return driver.id; },
    get type() { return "idah-video"; },
    get workflowStep(): IWorkflowStep { return "annotate"; },
    get status(): IEntryStatus { return "in_progress"; },
    get config(): IConfig { return SAMPLE_CONFIG; },
    get mediaUrl(): string {
      return "/sample.m3u8";
    },
    async mediaInfo(key?: string): Promise<IMedia> {
      const meta = driver.media.meta;
      return {
        resource: driver.media.id,
        key: key ?? driver.media.id,
        size: 5_242_880,
        mime_type: "video/mp4",
        filename: "sample.mp4",
        meta: {
          duration: meta.duration ?? 100,
          fps: meta.fps ?? 25,
          width: meta.width ?? 1920,
          height: meta.height ?? 1080,
        },
        created_by: 1,
        created_at: new Date(),
        updated_at: new Date(),
      };
    },
    get user(): IUser {
      return {
        id: 1,
        email: "annotator@example.com",
        name: "Demo Annotator",
        pictureUrl: "",
      };
    },
    get userRole() { return "annotator"; },
    get annotations(): IAnnotationDriver { return annotationDriver; },
    get notes(): INotes { return notesDriver; },
    get commands(): ICommands { return commandBridge; },
    get tools(): ITools { return toolsBridge; },
    get icons(): IIconDriver { return iconDriver; },
    back() { console.log("[bridge] back() — would navigate away"); },
    async submit(opts?: { approved: boolean }) { console.log("[bridge] submit()", opts); },
    async error(message: string) { console.log("[bridge] error():", message); },
    get shortcutReferences() { return shortcutRefs; },
    registerShortcutReferences(refs) {
      shortcutRefs = refs;
    },
  };
}
