import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record } from "@/data/model/Record";

export class WorkflowRecord extends Record {
  @field() public name!: string;
  @field() public label!: string;
  @field() public description!: string;
  @field() public plugin?: string;
  @field() public default?: boolean;
  @field() public steps?: Array<{
    name: string;
    label: string;
    description: string;
    actions?: Array<{
      name: string;
      label: string;
      icon?: string;
    }>;
  }>;
  @field() public allowed_note_feed?: Array<string>;
}

export const workflowsBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/workflows`;

export const workflowsBackendDataSource = createBackendDataSource(WorkflowRecord, workflowsBasePath, {
  getWorkflows: async (): Promise<WorkflowRecord[]> => {
    const response = await fetch(workflowsBasePath);
    const data = await response.json();

    // Add "default" as the first option
    const workflows: WorkflowRecord[] = [...(data.data?.workflows || [])];

    return workflows;
  },
});
