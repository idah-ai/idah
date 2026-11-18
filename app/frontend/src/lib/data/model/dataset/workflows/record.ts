import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";

@type("dataset:workflows")
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
  @field() public external_steps?: Array<string>;
}

export const workflowsBasePath: string = `/api/v1/dataset/workflows`;

RecordFactory.registerTypes(WorkflowRecord);

export const workflowsBackendDataSource = createBackendDataSource(WorkflowRecord, workflowsBasePath, {
  getWorkflows: async (): Promise<WorkflowRecord[]> => {
    const response = await fetch(workflowsBasePath, {
      method: "GET",
    });
    const body = await response.json();

    // Add "default" as the first option
    const workflows: WorkflowRecord[] = [...(body.data?.workflows || [])];

    return workflows;
  },
});
