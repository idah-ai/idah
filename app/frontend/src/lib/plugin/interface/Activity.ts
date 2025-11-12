// duplicate from yacine's

import type { Command } from "@/command/Command";
import type { AnnotationHeaderBarBaseTool } from "@/plugin/layout/header/annotation-header-bar.types";

export interface IFields {
  [key: string]: Array<string>;
}

export interface IFilters {
  [key: string]: unknown;
}

export interface IPagination {
  page: number;
  itemsPerPage: number;
}

export type ISort = Array<string>;

export interface IListOptions {
  fields?: IFields;
  filters?: IFilters;
  pagination?: IPagination;
  sort?: ISort;
}

interface IUser {
  id: number;
  email: string;
  name: string;
  pictureUrl: string;
}

export interface IDimension {
  type: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface IAnnotation<T = IDimension, U = any> {
  id: string;
  dimensions: T;
  annotation: U;
}

export interface INoteFeed {
  readonly id: string;
  entry_id: string;
  annotation_id: string | null;
  readonly created_by_email: string;

  anchor_type: "entry" | "annotation";
  position: Record<string, unknown>;

  readonly status: "pending" | "resolved";

  content_md: string;

  readonly created_at: string;
  readonly updated_at: string;
  readonly edited_at: string | null;
}

export interface INoteComment {
  readonly id: string;
  readonly note_feed_id: string;
  readonly is_edited: boolean;

  content_md: string;

  readonly created_by_email: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly edited_at: string | null;
}

export interface IAnnotationDriver {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create(id: string, dimension: any, annotation: any): Promise<IAnnotation>;

  update(ann: IAnnotation): Promise<void>;
  delete(id: string): Promise<void>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  list(filter: any, pagination: any): Promise<Array<IAnnotation>>;
  flush(): void;
}

export interface INotes {
  showNewNoteFeedPopup: (data: Pick<INoteFeed, "anchor_type" | "position" | "annotation_id">) => void;
  onNewNoteFeedOpenChange: (cb: (data: Pick<INoteFeed, "anchor_type" | "position" | "annotation_id">) => void) => void;

  requireNoteFeedPosition: (noteFeed: INoteFeed) => void;
  onRequireNoteFeedPosition: (cb: (noteFeed: INoteFeed) => void) => void;

  gotoFeed: (noteFeedId: string | null, noteCommentId?: string) => void;
  onNoteSelected: (cb: (noteFeedId: string | null, noteCommentId?: string) => Promise<void> | void) => void;
}

export interface ICategoryField {
  id: string;
  type: string;
  color: string;
  text_color?: string;
  label: string;
}

export type FieldTypeValue = "text" | "integer" | "boolean" | "single-select" | "multi-select";

export type LabelPropertyOption = {
  id: string;
  label: string;
};
export interface FieldFormat {
  // placeholder?: string;
  // readonly?: boolean;
  minimum: number | null;
  maximum: number | null;
  step: number | null;
  info: string | null;
  options: Array<LabelPropertyOption>;
}

export interface FieldBase {
  id: string;
  type: FieldTypeValue;
  label: string;
  description: string;
  required: boolean;
  format: FieldFormat;
  visible_if?: {
    [key: string]: Array<string | number | boolean>;
  };
}

export interface PropertyField extends FieldBase {
  selector: Array<string>;
}

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
export interface TagField extends FieldBase {}

export interface IConfig {
  categories: Array<ICategoryField>;
  properties: Array<PropertyField>;
  taggings: Array<TagField>;
}
export interface ICommands {
  on(name: string, commandBuilder: (props?: object) => Command): void;
  run(name: string, props?: object): void;
  undo(times?: number): void;
  redo(times?: number): void;
}

export interface HeaderBarModeTool extends AnnotationHeaderBarBaseTool {
  type: string;
}
export interface ITools {
  setTools: (tools: HeaderBarModeTool[]) => void;
  setTool: (tool: string) => void;
  onToolsChange: (cb: (tools: HeaderBarModeTool[]) => void) => void;
  onToolChange: (cb: (tool: string) => void) => void;
}

export interface IActivityContext {
  // Id of the current entry
  get id(): string;

  // Type of activity
  get type(): string;

  // Returns the current workflow step
  get workflowStep(): "start" | "annotate" | "review" | "done" | "export";

  // Returns the current status of the entry
  get status(): "processing" | "ready" | "assigned" | "in_progress" | "pending" | "completed" | "errored";

  // Get the dataset configuration
  get config(): IConfig;

  // Return the root media url
  get mediaUrl(): string;

  // Returns current user working on this activity
  get user(): IUser;

  // Return the role of the user
  get userRole(): string;

  // Driver for fetching and updating annotations
  get annotations(): IAnnotationDriver;

  // Driver for fetching and updating notes
  get notes(): INotes;

  get commands(): ICommands;

  get tools(): ITools;

  // Return to previous step of the workflow
  back(): void;

  // Submit to the next step of the workflow
  submit(opts?: { approved: boolean }): Promise<void>;

  // Mark this activity as errored
  error(message: string): Promise<void>;
}

export interface IActivityView {
  // Unique name of the activity
  get name(): string;
  // Label (displayed to the user)
  get label(): string;
  // Short description of the activity
  get description(): string;

  // Just a versioning system (?)
  get version(): string;

  get type(): string;

  // Initialize the activity with the given context and parent element
  init();
  render?(parent: HTMLElement | null, context: IActivityContext);
  close?();
}
