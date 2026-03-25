import type {
  IActivityContext,
  IAnnotationDriver,
  ICommands,
  IEntryStatus,
  INotes,
  ITools,
  IWorkflowStep,
} from "$idah/context/activity-context";

export const activityContextExample: IActivityContext = {
  get id() {
    return "test-entry-1";
  },
  get type() {
    return "video-annotation";
  },
  get workflowStep(): IWorkflowStep {
    return "annotate";
  },
  get status(): IEntryStatus {
    return "in_progress";
  },
  get config() {
    return {};
  },
  get mediaUrl() {
    return "http://localhost:5173/medias/image.jpg";
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
  get commands(): ICommands {
    return {
      on: (name, commandBuilder, manager) => {},
      run: (name, props) => {},
      undo: (times) => {},
      redo: (times) => {},
    };
  },
  get tools(): ITools {
    return {
      setTools: (tools) => {},
      setTool: (tool) => {},
      onToolsChange: (cb) => {},
      onToolChange: (cb) => {},
    };
  },
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
