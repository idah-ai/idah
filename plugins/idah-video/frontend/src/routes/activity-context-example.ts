import type { Command } from "$idah/command/command";

import CommandManager from "$idah/command/command-manager";
import type {
  HeaderBarModeTool,
  IActivityContext,
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

function createCommandsInterface(): ICommands {
  const commands = new Map();

  return {
    on: <T>(name: string, builder: (props: T) => ICommand | void | Promise<ICommand | void>, manager = true) => {
      commands.set(name, { manager, builder });
      console.debug({ command_on: name, manager });
    },
    async run<T>(name: string, props?: T) {
      const commandData = commands.get(name);
      if (!commandData) return console.error("builder not found command:", name);

      const { manager, builder } = commandData;

      const command = (await builder(props as T)) as Command;

      if (!command)
        // properly extract and we shouldnt have to await ?
        return console.error("builder error on command:", name);

      console.debug({ command_run: name, props, command });
      if (manager) CommandManager.add(command);
      else command.apply();
    },
    undo(times?: number) {
      console.debug({ command_undo: { times } });
      CommandManager.undo(times);
    },
    redo(times?: number) {
      console.debug({ command_redo: { times } });
      CommandManager.redo(times);
    },
  };
}

function createToolsInterface(): ITools {
  let _onToolsChange: ((tools: HeaderBarModeTool[]) => void) | undefined;
  let _onToolChange: ((tool: string) => void) | undefined;

  return {
    setTools: (tools: HeaderBarModeTool[]) => {
      console.debug({ tools });
      _onToolsChange?.(tools);
    },
    setTool: (tool: string) => {
      console.debug({ tool });
      _onToolChange?.(tool);
    },
    onToolsChange: (cb) => (_onToolsChange = cb),
    onToolChange: (cb) => (_onToolChange = cb),
  };
}

async function createIconInterface(): Promise<IIconDriver> {
  return {
    async get(iconName: string) {
      switch (iconName) {
        case "cursor-note": {
          return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle-icon lucide-message-circle"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>';
        }
        case "message-circle": {
          return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle-icon lucide-message-circle"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>';
        }
        case "mouse-pointer-2": {
          return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mouse-pointer2-icon lucide-mouse-pointer-2"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/></svg>';
        }
        case "polygon": {
          return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 6L13 7M16 10L18 16M16 18L10.5 17M7.5 13L6 8M8 5.5C8 6.88071 6.88071 8 5.5 8C4.11929 8 3 6.88071 3 5.5C3 4.11929 4.11929 3 5.5 3C6.88071 3 8 4.11929 8 5.5ZM11 15.5C11 16.8807 9.88071 18 8.5 18C7.11929 18 6 16.8807 6 15.5C6 14.1193 7.11929 13 8.5 13C9.88071 13 11 14.1193 11 15.5ZM18 7.5C18 8.88071 16.8807 10 15.5 10C14.1193 10 13 8.88071 13 7.5C13 6.11929 14.1193 5 15.5 5C16.8807 5 18 6.11929 18 7.5ZM21 18.5C21 19.8807 19.8807 21 18.5 21C17.1193 21 16 19.8807 16 18.5C16 17.1193 17.1193 16 18.5 16C19.8807 16 21 17.1193 21 18.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        }
        case "vector-square": {
          return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-vector-square-icon lucide-vector-square"><path d="M19.5 7a24 24 0 0 1 0 10"/><path d="M4.5 7a24 24 0 0 0 0 10"/><path d="M7 19.5a24 24 0 0 0 10 0"/><path d="M7 4.5a24 24 0 0 1 10 0"/><rect x="17" y="17" width="5" height="5" rx="1"/><rect x="17" y="2" width="5" height="5" rx="1"/><rect x="2" y="17" width="5" height="5" rx="1"/><rect x="2" y="2" width="5" height="5" rx="1"/></svg>';
        }
        default: {
          return "";
        }
      }
    },
  };
}

export const activityContextExample: IActivityContext = {
  get id() {
    return "test-entry-1";
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
          {
            id: "vehicles/car",
            color: "#F6402B",
            label: "Car",
            text_color: "#FFFFFF",
          },
          {
            id: "vehicles/bus",
            color: "#EB1461",
            label: "Bus",
            text_color: "#FFFFFF",
          },
          {
            id: "vehicles/van",
            color: "#9C1AB2",
            label: "Van",
            text_color: "#FFFFFF",
          },
          {
            id: "person",
            color: "#1464EB",
            label: "Person",
            text_color: "#FFFFFF",
          },
        ],
        properties: [
          {
            id: "wheels",
            type: "integer",
            label: "Wheels",
            format: { maximum: 10, minimum: 4 },
            required: true,
            visibility: true,
            description: "",
          },
        ],
      },
    };
  },
  get mediaUrl() {
    return "http://localhost:5173/medias/video.mp4";
  },
  get user() {
    return {
      id: 1,
      email: "test@example.com",
      name: "Test User",
      pictureUrl: "",
    };
  },
  get userRole() {
    return "annotator";
  },
  get annotations(): IAnnotationDriver {
    return {
      create: async (id, dimension, annotation) => ({
        id,
        dimensions: dimension,
        annotation,
      }),
      update: async (ann) => {},
      delete: async (id) => {},
      list: async (filter, pagination) => [],
      flush: () => {},
    };
  },
  get notes(): INotes {
    return {
      showNewNoteFeedPopup: (data) => {},
      onNewNoteFeedOpenChange: (cb) => {},
      requireNoteFeedPosition: (noteFeed) => {},
      onRequireNoteFeedPosition: (cb) => {},
      gotoFeed: (noteFeedId, noteCommentId) => {},
      onNoteSelected: (cb) => {},
      setTargetDomRect: (rect) => {},
      onTargetDomRectChange: (cb) => {},
      setZoomInfo: (zoomInfo) => {},
      onZoomInfoChange: (cb) => {},
    };
  },
  commands: createCommandsInterface(),
  tools: createToolsInterface(),
  icons: createIconInterface(),
  back: () => {
    console.log("back called");
  },
  submit: async (opts) => {
    console.log("submit called", opts);
  },
  error: async (message) => {
    console.log("error called", message);
  },

  get shortcutReferences():
    | Record<string, { label: string; description: string; keyCombinations: string[] }>
    | undefined {
    return undefined;
  },

  registerShortcutReferences(
    refs: Record<string, { label: string; description: string; keyCombinations: string[] }>,
  ): void {
    console.log("registerShortcutReferences called", refs);
  },
};
