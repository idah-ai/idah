import type { Command } from "$idah/command/command";

import CommandManager from "$idah/command/command-manager";
import type {
  HeaderBarModeTool,
  IActivityContext,
  IMedia,
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
        case "pen-tool-add-2": {
          return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.25475 15.3958L2.19718 3.72745L2.44238 2.67456L13.2885 8.53048L12.8702 15.093L14.1683 14.2853L16.1875 17.5306L9.04799 21.9728L6.90618 19.2541L7.67783 18.3238L2.25475 15.3958Z" fill="white"/> <path d="M1.45413 1.0893C1.76588 0.897348 2.15601 0.880502 2.48337 1.04788L14.2073 7.04772L14.2418 7.06705L14.31 7.1095L14.336 7.12678C14.6239 7.33138 14.7908 7.66906 14.7771 8.02592L14.5827 13.0497C14.6471 13.053 14.7118 13.0607 14.7753 13.0758L14.8758 13.105C15.072 13.1733 15.2431 13.2988 15.3681 13.464L15.4267 13.5504L17.3823 16.7529C17.6843 17.2481 17.5299 17.8956 17.0353 18.2002L9.58182 22.7898C9.08602 23.0951 8.4379 22.9388 8.13456 22.4428L8.13361 22.4425L6.17899 19.2403L6.17804 19.24C6.0331 19.0024 5.98838 18.7162 6.05338 18.4449L6.05361 18.444C6.06906 18.3798 6.09047 18.3178 6.11719 18.2584L1.57122 16.155C1.20095 15.9835 0.960975 15.6121 0.960404 15.2011L0.952344 1.98828C0.952245 1.62165 1.1426 1.28112 1.45413 1.0893ZM8.52077 19.0356L9.37849 20.4423L15.0408 16.9566L14.1819 15.5506L8.52077 19.0356ZM7.40405 8.80867C7.7667 8.74634 8.14804 8.75309 8.52925 8.8445L8.80598 8.92592C10.1549 9.39845 10.9497 10.8287 10.609 12.2495C10.2681 13.6704 8.91119 14.5837 7.49499 14.393L7.21143 14.3401C5.69718 13.977 4.76714 12.4517 5.13051 10.9358C5.22238 10.5527 5.38871 10.2073 5.60929 9.91078L3.05737 5.73176L3.06409 14.5235L8.0702 16.8397L12.4355 14.1517L12.6489 8.61725L4.84924 4.62494L7.40405 8.80867ZM8.03783 10.8938C7.65624 10.8023 7.26894 11.0389 7.17604 11.4263L7.15563 11.57C7.14403 11.9046 7.36842 12.2106 7.70285 12.2908C8.08432 12.3821 8.47052 12.1462 8.56347 11.759L8.58315 11.6141C8.59457 11.2793 8.37114 10.9739 8.03783 10.8938Z" fill="black" stroke="white" stroke-linecap="round" stroke-linejoin="round"/> <path d="M18.6154 1.01172C19.1568 1.06682 19.5771 1.52498 19.5773 2.0791V4.44141H21.9288C22.5221 4.44152 23 4.9237 23.0001 5.51465C23.0001 6.10573 22.5222 6.58875 21.9288 6.58887H19.5773V8.96191C19.5772 9.55287 19.0992 10.035 18.506 10.0352C17.9129 10.035 17.4348 9.55305 17.4347 8.96191V6.58887H15.0714C14.478 6.5888 14.0001 6.10576 14.0001 5.51465C14.0003 4.92367 14.4781 4.44148 15.0714 4.44141H17.4347V2.0791C17.4348 1.488 17.9129 1.006 18.506 1.00586L18.6154 1.01172Z" fill="black" stroke="white" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        }
        case "pen-tool-remove-2": {
          return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.25475 15.3958L2.19718 3.72745L2.44238 2.67456L13.2885 8.53048L12.8702 15.093L14.1683 14.2853L16.1875 17.5306L9.04799 21.9728L6.90618 19.2541L7.67783 18.3238L2.25475 15.3958Z" fill="white"/><path d="M1.45413 1.0893C1.76588 0.897348 2.15601 0.880502 2.48337 1.04788L14.2073 7.04772L14.2418 7.06705L14.31 7.1095L14.336 7.12678C14.6239 7.33138 14.7908 7.66906 14.7771 8.02592L14.5827 13.0497C14.6471 13.053 14.7118 13.0607 14.7753 13.0758L14.8758 13.105C15.072 13.1733 15.2431 13.2988 15.3681 13.464L15.4267 13.5504L17.3823 16.7529C17.6843 17.2481 17.5299 17.8956 17.0353 18.2002L9.58182 22.7898C9.08602 23.0951 8.4379 22.9388 8.13456 22.4428L8.13361 22.4425L6.17899 19.2403L6.17804 19.24C6.0331 19.0024 5.98838 18.7162 6.05338 18.4449L6.05361 18.444C6.06906 18.3798 6.09047 18.3178 6.11719 18.2584L1.57122 16.155C1.20095 15.9835 0.960975 15.6121 0.960404 15.2011L0.952344 1.98828C0.952245 1.62165 1.1426 1.28112 1.45413 1.0893ZM8.52077 19.0356L9.37849 20.4423L15.0408 16.9566L14.1819 15.5506L8.52077 19.0356ZM7.40405 8.80867C7.7667 8.74634 8.14804 8.75309 8.52925 8.8445L8.80598 8.92592C10.1549 9.39845 10.9497 10.8287 10.609 12.2495C10.2681 13.6704 8.91119 14.5837 7.49499 14.393L7.21143 14.3401C5.69718 13.977 4.76714 12.4517 5.13051 10.9358C5.22238 10.5527 5.38871 10.2073 5.60929 9.91078L3.05737 5.73176L3.06409 14.5235L8.0702 16.8397L12.4355 14.1517L12.6489 8.61725L4.84924 4.62494L7.40405 8.80867ZM8.03783 10.8938C7.65624 10.8023 7.26894 11.0389 7.17604 11.4263L7.15563 11.57C7.14403 11.9046 7.36842 12.2106 7.70285 12.2908C8.08432 12.3821 8.47052 12.1462 8.56347 11.759L8.58315 11.6141C8.59457 11.2793 8.37114 10.9739 8.03783 10.8938Z" fill="black" stroke="white" stroke-linecap="round" stroke-linejoin="round"/><path d="M21.9288 4.44141C22.5221 4.44152 23 4.92369 23.0001 5.51465C23.0001 6.10573 22.5222 6.58875 21.9288 6.58887H15.0714C14.478 6.5888 14.0001 6.10576 14.0001 5.51465C14.0003 4.92366 14.4781 4.44148 15.0714 4.44141H21.9288Z" fill="black" stroke="white" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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

  mediaInfo(key?: string): Promise<IMedia> {
    console.log("mediaInfo called with key:", key);
    return Promise.resolve({
      resource: "test-entry-1",
      key: key || "master",
      size: 123456789,
      mime_type: "video/mp4",
      filename: "video.mp4",
      meta: {
        duration: 37.375000,
        fps: 24,
      },
      created_by: 1,
      created_at: new Date(),
      updated_at: new Date(),
    });
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
