import type { Command } from "$idah/command/command";

import CommandManager from "$idah/command/command-manager";
import type {
  HeaderBarModeTool,
  IActivityContext,
  IAnnotationDriver,
  ICommands,
  IConfig,
  IEntryStatus,
  INotes,
  ITools,
  IWorkflowStep,
} from "$idah/context/activity-context";

function createCommandsInterface(): ICommands {
  const commands = new Map();

  return {
    on: (name: string, builder: (props?: object) => Command, manager = true) => {
      commands.set(name, { manager, builder });
      console.debug({ command_on: name, manager });
    },
    async run(name: string, props?: object) {
      const { manager, builder }: { manager: boolean; builder: (props?: object) => Command } = commands.get(name);

      if (!builder) return console.error("builder not found command:", name);

      const command = await builder(props);

      if (!commands)
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
    };
  },
  commands: createCommandsInterface(),
  tools: createToolsInterface(),
  back: () => {
    console.log("back called");
  },
  submit: async (opts) => {
    console.log("submit called", opts);
  },
  error: async (message) => {
    console.log("error called", message);
  },
};
