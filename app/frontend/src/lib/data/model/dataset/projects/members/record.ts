import { createBackendDataSource } from "@/data/BackendDataSource";
import { parseCollectionReturn, parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

import type { LabelValue } from "@/utils/types";

@type("dataset:project_members")
export class ProjectMemberRecord extends Record {
  @field() public project_id!: string; // UUID

  @field() public account_id!: number;
  @field() public name!: string | null;
  @field() public email!: string;

  @field() public role!: ProjectMemberRole;

  @field() public invited_by_id!: number;
  @field() public disabled_at!: Date | null;

  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;

  @relationship() public project!: ProjectRecord;
}

RecordFactory.registerTypes(ProjectMemberRecord);

export const projectMembersBasePath: string = `/api/v1/dataset/project_members`;

export const projectMembersBackendDataSource = createBackendDataSource(ProjectMemberRecord, projectMembersBasePath, {
  /**
   * Batch-invite members to a project (all-or-nothing). The backend validates
   * every member first and returns a per-email reason on failure.
   */
  invite: async (params: { project_id: string; members: Array<{ email: string; role: ProjectMemberRole }> }) => {
    const res = await fetch(`${projectMembersBasePath}/invite`, {
      method: "POST",
      body: JSON.stringify(params),
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    const body = await res.json();

    if (body && body.errors) {
      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    // The backend returns the batch of created/re-enabled members as a JSON:API
    // collection (`data: [...]`), so parse it as a collection.
    if (body && body.data) return Promise.resolve(parseCollectionReturn<ProjectMemberRecord>(body));

    throw "No data returned";
  },

  /** Resend a project member invitation (guarded). */
  resend_invitation: async (params: { id: string }) => {
    const { id } = params;

    const res = await fetch(`${projectMembersBasePath}/${id}/resend_invitation`, {
      method: "POST",
      body: JSON.stringify({ id }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    const body = await res.json();

    if (body && body.errors) {
      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body && body.data) return Promise.resolve(parseSingleElementReturn<ProjectMemberRecord>(body));

    throw "No data returned";
  },
});

export const projectMemberRoles = [
  { label: "Project Owner", value: "project_owner" },
  { label: "Reviewer", value: "reviewer" },
  { label: "Annotator", value: "annotator" },
] as LabelValue<string | number>[];

export type ProjectMemberRole = (typeof projectMemberRoles)[number]["value"];
