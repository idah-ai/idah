// duplicate from yacine's

interface IUser {
  id: number;
  email: string;
  name: string;
  pictureUrl: string;
}

export interface IDimension {
  type: string;
}

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
  position?: any;
  fetchDiscussion: Promise<Array<IComment>>;
  status: string;

  reply(content: string): Promise<IComment>;

  resolve(): Promise<boolean>;
}

export interface IAnnotationDriver {
  create(id: string, dimension: any, annotation: any): Promise<IAnnotation>;
  update(ann: IAnnotation): Promise<void>;
  delete(id: string): Promise<void>;
  list(filter: any, pagination: any): Promise<Array<IAnnotation>>;
}

export interface INoteDriver {
  create(position: any, content: string): Promise<INote>;
  list(filter: any): Promise<Array<INote>>;
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
  get config(): any;

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
  init(context: IActivityContext);
  render?(parent: HTMLElement);
  close?();
}
