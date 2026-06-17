// Shared types for workflow step configuration
export interface WorkflowStepAction {
  key: string;
  label: string;
  icon?: string;
}

export interface WorkflowStepConfig {
  name: string;
  label: string;
  description?: string;
  actions?: WorkflowStepAction[];
}