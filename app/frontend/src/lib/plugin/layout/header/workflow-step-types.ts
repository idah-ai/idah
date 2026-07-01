// Shared types for workflow step configuration
export interface WorkflowStepActionChoice {
  label: string;
  icon?: string;
  value: boolean;
}

export interface WorkflowStepAction {
  name: string;
  choices: WorkflowStepActionChoice[];
}

export interface WorkflowStepConfig {
  name: string;
  label: string;
  description?: string;
  actions?: WorkflowStepAction[];
}
