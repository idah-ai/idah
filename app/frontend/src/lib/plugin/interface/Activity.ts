// duplicate from yacine's

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

export interface INoteFeed {
  id: string;
  entry_id: string;
  annotation_id: string | null;
  readonly created_by_id: number;

  anchor_type: "entry" | "annotation";
  position: Record<string, unknown>;

  readonly status: "pending" | "resolved";

  content_md: string;

  created_at: string;
  updated_at: string;
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
  create(data: Partial<INoteFeed>): Promise<INoteFeed>;

  list(listOptions: IListOptions): Promise<Array<INoteFeed>>;

  markAsResolved(noteFeedId: string): Promise<INoteFeed>;
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

export interface FieldBase {
  id: string;
  type: FieldTypeValue;
  label: string;
  description: string;
  required: boolean;
  format: {
    // placeholder?: string;
    // readonly?: boolean;
    minimum: number | null;
    maximum: number | null;
    step: number | null;
    info: string | null;
    options: Array<LabelPropertyOption>;
  };
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
  get notes(): INoteDriver;

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
  render?(parent: HTMLElement, context: IActivityContext);
  close?();
}
