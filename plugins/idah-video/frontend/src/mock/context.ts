import type { Command } from "$idah/command/command";
import CommandManager from "$idah/command/command-manager";
import type {
  HeaderBarModeTool,
  IActivityContext,
  IMedia,
  IAnnotation,
  IAnnotationDriver,
  ICommand,
  ICommands,
  IConfig,
  IEntryStatus,
  IIconDriver,
  INotes,
  ITools,
  IWorkflowStep,
} from "$idah/context/activity-context";
import type { Hash } from "$idah/utils/types";

// ---------------------------------------------------------------------------
// Sample annotations to seed the mock
// ---------------------------------------------------------------------------
const SAMPLE_ANNOTATIONS: IAnnotation[] = [
  {
    id: "ann-001",
    dimensions: {
      type: "idah-video:bounding-box",
      start: 15,
      end: 120,
      frames: [
        { frame: 15, points: [[0.2, 0.3], [0.45, 0.5]], angle: 0 },
        { frame: 60, points: [[0.22, 0.28], [0.48, 0.52]], angle: 2 },
        { frame: 120, points: [[0.25, 0.25], [0.50, 0.55]], angle: 3 },
      ],
    },
    annotation: {
      category: "vehicles/car",
      attributes: { wheels: 4 },
    },
    created_by_id: "1",
    created_at: new Date("2025-01-01T10:00:00Z"),
    updated_at: new Date("2025-01-01T10:00:00Z"),
    metadata: { group_id: "group-001" },
  },
  {
    id: "ann-002",
    dimensions: {
      type: "idah-video:bounding-box",
      start: 200,
      end: 450,
      frames: [
        { frame: 200, points: [[0.6, 0.4], [0.8, 0.7]], angle: 0 },
        { frame: 300, points: [[0.58, 0.38], [0.78, 0.68]], angle: -1 },
        { frame: 450, points: [[0.55, 0.35], [0.75, 0.65]], angle: -2 },
      ],
    },
    annotation: {
      category: "vehicles/bus",
      attributes: { wheels: 6 },
    },
    created_by_id: "1",
    created_at: new Date("2025-01-01T10:01:00Z"),
    updated_at: new Date("2025-01-01T10:01:00Z"),
    metadata: { group_id: "group-002" },
  },
  {
    id: "ann-003",
    dimensions: {
      type: "idah-video:polygon",
      start: 50,
      end: 180,
      frames: [
        {
          frame: 50,
          points: [
            [0.1, 0.1],
            [0.3, 0.05],
            [0.35, 0.2],
            [0.15, 0.25],
          ],
          angle: 0,
        },
        {
          frame: 120,
          points: [
            [0.12, 0.08],
            [0.32, 0.04],
            [0.37, 0.18],
            [0.17, 0.23],
          ],
          angle: 0,
        },
        {
          frame: 180,
          points: [
            [0.15, 0.05],
            [0.35, 0.02],
            [0.40, 0.15],
            [0.20, 0.20],
          ],
          angle: 0,
        },
      ],
    },
    annotation: {
      category: "person",
    },
    created_by_id: "1",
    created_at: new Date("2025-01-01T10:02:00Z"),
    updated_at: new Date("2025-01-01T10:02:00Z"),
    metadata: { group_id: "group-003" },
  },
  {
    id: "ann-004",
    dimensions: {
      type: "idah-video:bounding-box",
      start: 600,
      end: 800,
      frames: [
        { frame: 600, points: [[0.7, 0.5], [0.9, 0.8]], angle: 0 },
        { frame: 700, points: [[0.68, 0.48], [0.88, 0.78]], angle: 0 },
        { frame: 800, points: [[0.65, 0.45], [0.85, 0.75]], angle: 0 },
      ],
    },
    annotation: {
      category: "vehicles/van",
      attributes: { wheels: 4 },
    },
    created_by_id: "1",
    created_at: new Date("2025-01-01T10:03:00Z"),
    updated_at: new Date("2025-01-01T10:03:00Z"),
    metadata: { group_id: "group-004" },
  },
];

// ---------------------------------------------------------------------------
// In-memory annotation store for the mock driver
// ---------------------------------------------------------------------------
let mockAnnotations: IAnnotation[] = [...SAMPLE_ANNOTATIONS];

function createCommandsInterface(): ICommands {
  const commands = new Map<
    string,
    { manager: boolean; builder: (props: unknown) => ICommand | void | Promise<ICommand | void> }
  >();

  return {
    on: <T>(name: string, builder: (props: T) => ICommand | void | Promise<ICommand | void>, manager = true) => {
      // Wrap the typed builder to accept unknown
      const wrappedBuilder = (props: unknown): ICommand | void | Promise<ICommand | void> => {
        return builder(props as T);
      };
      commands.set(name, { manager, builder: wrappedBuilder });
      console.debug("[mock] command registered:", name, { manager });
    },
    async run<T>(name: string, props?: T) {
      const commandData = commands.get(name);
      if (!commandData) return console.error("[mock] command not found:", name);

      const { manager, builder } = commandData;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const command = (await builder(props as any)) as Command;

      if (!command) return console.error("[mock] builder returned no command for:", name);

      console.debug("[mock] command run:", name, { props, command });
      if (manager) CommandManager.add(command);
      else command.apply();
    },
    undo(times?: number) {
      console.debug("[mock] undo", { times });
      CommandManager.undo(times);
    },
    redo(times?: number) {
      console.debug("[mock] redo", { times });
      CommandManager.redo(times);
    },
  };
}

function createToolsInterface(): ITools {
  let _onToolsChange: ((tools: HeaderBarModeTool[]) => void) | undefined;
  let _onToolChange: ((tool: string) => void) | undefined;

  return {
    setTools: (tools: HeaderBarModeTool[]) => {
      console.debug("[mock] tools set:", tools.map((t) => t.name));
      _onToolsChange?.(tools);
    },
    setTool: (tool: string) => {
      console.debug("[mock] tool set:", tool);
      _onToolChange?.(tool);
    },
    onToolsChange: (cb) => {
      _onToolsChange = cb;
    },
    onToolChange: (cb) => {
      _onToolChange = cb;
    },
  };
}

function createIconInterface(): IIconDriver {
  return {
    async get(iconName: string) {
      switch (iconName) {
        case "cursor-note":
        case "message-circle": {
          return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>`;
        }
        case "mouse-pointer-2": {
          return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mouse-pointer-2"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/></svg>`;
        }
        case "polygon": {
          return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 6L13 7M16 10L18 16M16 18L10.5 17M7.5 13L6 8M8 5.5C8 6.88071 6.88071 8 5.5 8C4.11929 8 3 6.88071 3 5.5C3 4.11929 4.11929 3 5.5 3C6.88071 3 8 4.11929 8 5.5ZM11 15.5C11 16.8807 9.88071 18 8.5 18C7.11929 18 6 16.8807 6 15.5C6 14.1193 7.11929 13 8.5 13C9.88071 13 11 14.1193 11 15.5ZM18 7.5C18 8.88071 16.8807 10 15.5 10C14.1193 10 13 8.88071 13 7.5C13 6.11929 14.1193 5 15.5 5C16.8807 5 18 6.11929 18 7.5ZM21 18.5C21 19.8807 19.8807 21 18.5 21C17.1193 21 16 19.8807 16 18.5C16 17.1193 17.1193 16 18.5 16C19.8807 16 21 17.1193 21 18.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        }
        case "vector-square": {
          return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-vector-square"><path d="M19.5 7a24 24 0 0 1 0 10"/><path d="M4.5 7a24 24 0 0 0 0 10"/><path d="M7 19.5a24 24 0 0 0 10 0"/><path d="M7 4.5a24 24 0 0 1 10 0"/><rect x="17" y="17" width="5" height="5" rx="1"/><rect x="17" y="2" width="5" height="5" rx="1"/><rect x="2" y="17" width="5" height="5" rx="1"/><rect x="2" y="2" width="5" height="5" rx="1"/></svg>`;
        }
        default: {
          console.warn("[mock] icon not found:", iconName);
          return "";
        }
      }
    },
  };
}

function createNotesInterface(): INotes {
  return {
    showNewNoteFeedPopup: (data) => {
      console.debug("[mock] show new note popup:", data);
    },
    onNewNoteFeedOpenChange: (cb) => {
      // no-op; we don't track the callback
    },
    requireNoteFeedPosition: (noteFeed) => {
      console.debug("[mock] require note feed position:", noteFeed.id);
    },
    onRequireNoteFeedPosition: (cb) => {
      // no-op
    },
    gotoFeed: (noteFeedId, noteCommentId) => {
      console.debug("[mock] goto feed:", noteFeedId, noteCommentId);
    },
    onNoteSelected: (cb) => {
      // no-op
    },
  };
}

// ---------------------------------------------------------------------------
// Mock IActivityContext
// ---------------------------------------------------------------------------
export const mockContext: IActivityContext = {
  get id() {
    return "mock-entry-001";
  },

  get type() {
    return "idah-video";
  },

  get workflowStep(): IWorkflowStep {
    return "annotate";
  },

  get status(): IEntryStatus {
    return "in_progress";
  },

  get config(): IConfig {
    return {
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
  },

  get mediaUrl() {
    return "/sample.m3u8";
  },

  async mediaInfo(key?: string): Promise<IMedia> {
    // Simulate a ~100 second video at 25 fps = 250 frames
    return {
      resource: key || "mock-entry-001",
      key: key || "master",
      size: 5_242_880,
      mime_type: "video/mp4",
      filename: "sample.mp4",
      meta: {
        duration: 100,
        fps: 25,
        width: 1920,
        height: 1080,
      },
      created_by: 1,
      created_at: new Date(),
      updated_at: new Date(),
    };
  },

  get user() {
    return {
      id: 1,
      email: "annotator@example.com",
      name: "Demo Annotator",
      pictureUrl: "",
    };
  },

  get userRole() {
    return "annotator";
  },

  get annotations(): IAnnotationDriver {
    return {
      async create(id: string, dimension: Hash, annotation: Hash, metadata?: Hash): Promise<IAnnotation> {
        const now = new Date();
        const created: IAnnotation = {
          id,
          dimensions: dimension as Hash & { type: string },
          annotation,
          created_by_id: "1",
          created_at: now,
          updated_at: now,
          metadata: metadata || {},
        };
        mockAnnotations.push(created);
        console.debug("[mock] annotation created:", id);
        return created;
      },

      async update(ann: IAnnotation): Promise<void> {
        const idx = mockAnnotations.findIndex((a) => a.id === ann.id);
        if (idx !== -1) {
          mockAnnotations[idx] = { ...mockAnnotations[idx], ...ann, updated_at: new Date() };
          console.debug("[mock] annotation updated:", ann.id);
        }
      },

      async delete(id: string): Promise<void> {
        mockAnnotations = mockAnnotations.filter((a) => a.id !== id);
        console.debug("[mock] annotation deleted:", id);
      },

      async list(filter: Hash, pagination: Hash): Promise<IAnnotation[]> {
        // Support simple pagination
        const page = (pagination.page as number) || 1;
        const itemsPerPage = (pagination.itemsPerPage as number) || 100;
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = mockAnnotations.slice(start, end);
        console.debug(`[mock] annotations list: page ${page}, returning ${pageItems.length} items`);
        return pageItems;
      },

      flush(): void {
        console.debug("[mock] annotations flush (no-op)");
      },
    };
  },

  get notes(): INotes {
    return createNotesInterface();
  },

  commands: createCommandsInterface(),

  tools: createToolsInterface(),

  icons: createIconInterface(),

  back() {
    console.log("[mock] back() called — would navigate away");
  },

  async submit(opts?: { approved: boolean }) {
    console.log("[mock] submit() called", opts);
  },

  async error(message: string) {
    console.log("[mock] error() called:", message);
  },

  get shortcutReferences():
    | Record<string, { label: string; description: string; keyCombinations: string[] }>
    | undefined {
    return undefined;
  },

  registerShortcutReferences(
    refs: Record<string, { label: string; description: string; keyCombinations: string[] }>,
  ): void {
    console.debug("[mock] shortcut references registered:", Object.keys(refs).length, "shortcuts");
  },
};
