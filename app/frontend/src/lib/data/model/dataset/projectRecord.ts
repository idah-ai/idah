import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "../Record";

@type("dataset:projects")
export class ProjectRecord extends Record {}

RecordFactory.registerTypes(ProjectRecord);

export const entriesJsonApiDataSource = createBackendDataSource(
  ProjectRecord,
  "https://idah.localhost:8443/api/v1/dataset/entries",
);
