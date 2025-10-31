// duplicate from yacine's

import type { Command } from "@/command/Command";
import type { AnnotationHeaderBarBaseTool } from "../layout/header/AnnotationHeaderBar.types";

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

interface IComment {
  id: string;
  createdBy: IUser;
  content: string;

  update(content: string): Promise<boolean>;
}

export interface INote {
  id: string;
  createdBy: IUser;
  target?: IAnnotation;
  content: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  position?: any;
  fetchDiscussion: Promise<Array<IComment>>;
  status: string;

  reply(content: string): Promise<IComment>;

  resolve(): Promise<boolean>;
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

export interface INoteDriver {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create(position: any, content: string): Promise<INote>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  list(filter: any): Promise<Array<INote>>;
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
  get workflowStep(): string;

  // Returns the current status of the entry
  get status(): string;

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
  get notes(): INoteDriver;

  get commands(): ICommands;

  get tools(): ITools;

  // Return to previous step of the workflow
  back(): void;

  // Submit to the next step of the workflow
  submit(): Promise<void>;

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
  render?(parent: HTMLElement, context: IActivityContext);
  close?();
}
