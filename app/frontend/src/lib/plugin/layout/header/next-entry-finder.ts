import { get } from "svelte/store";
import { authStatus } from "@/security/AuthContext";
import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
import {
  projectMembersBackendDataSource,
  ProjectMemberRecord,
} from "@/data/model/dataset/projects/members/record";

import type { ProjectMemberRole } from "@/data/model/dataset/projects/members/record";
import type { EntryWorkflowStep } from "@/data/model/dataset/entries/constants";

/**
 * Determines the user's role in the given project by checking:
 * 1. Global role (admin, org_owner) — treated as "owner-like"
 * 2. Project member role (project_owner, reviewer, annotator)
 */
export async function getCurrentUserProjectRole(
  projectId: string,
): Promise<"annotator" | "reviewer" | "owner_like"> {
  const authCtx = get(authStatus).authContext;
  if (!authCtx) return "annotator";

  // Global admin or org_owner → owner-like
  if (authCtx.roleName === "admin" || authCtx.roleName === "org_owner") {
    return "owner_like";
  }

  // Check project membership
  try {
    const memberRes = await projectMembersBackendDataSource.list({
      fields: { [ProjectMemberRecord.type]: ["id", "role"] },
      filters: { project_id: projectId, account_id: authCtx.id },
    });

    const member = memberRes.data[0];
    if (!member) return "annotator";

    const role = member.role as ProjectMemberRole;
    if (role === "project_owner") return "owner_like";
    if (role === "reviewer") return "reviewer";
    return "annotator";
  } catch {
    return "annotator";
  }
}

/**
 * Finds the next entry to redirect to after submission, based on the user's
 * project role and the workflow step of the entry that was just submitted.
 *
 * Returns the entry ID if found, or null to fall back to default behavior.
 */
export async function findNextEntry(params: {
  datasetId: string;
  projectId: string;
  submittedEntryWfStep: EntryWorkflowStep;
}): Promise<string | null> {
  const { datasetId, projectId, submittedEntryWfStep } = params;

  const authCtx = get(authStatus).authContext;
  if (!authCtx) return null;

  const userRole = await getCurrentUserProjectRole(projectId);
  const accountId = authCtx.id;

  // Helper: fetch first entry matching filters
  async function fetchFirst(filters: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await entriesBackendDataSource.list({
        fields: { [EntryRecord.type]: ["id"] },
        filters: { dataset_id: datasetId, ...filters },
        noCache: true,
        pagination: { page: 1, itemsPerPage: 1 },
      });
      return res.data.length > 0 ? res.data[0].id : null;
    } catch {
      return null;
    }
  }

  /**
   * Returns filters for unassigned entries using the backend's `assigned` custom filter.
   * The custom filter `assigned: "false"` maps to `assigned_to_id IS NULL`.
   */
  function unassigned(filters: Record<string, unknown>): Record<string, unknown> {
    return { ...filters, assigned: "false" };
  }

  /**
   * Returns filters for entries assigned to the given account.
   */
  function assignedTo(accountId: string, filters: Record<string, unknown>): Record<string, unknown> {
    return { ...filters, assigned_to_id: accountId };
  }

  // ── Annotator ─────────────────────────────────────────────────────────
  if (userRole === "annotator") {
    // Annotators only work on the annotate step
    return await fetchFirst(assignedTo(accountId, { wf_step: "annotate" }));
  }

  // ── Reviewer ──────────────────────────────────────────────────────────
  if (userRole === "reviewer") {
    if (submittedEntryWfStep === "annotate") {
      // After reviewing an annotate-step entry, go to next annotate entry assigned to me
      return await fetchFirst(assignedTo(accountId, { wf_step: "annotate" }));
    }

    if (submittedEntryWfStep === "review") {
      // Priority 1: assigned to me, wf_step = review
      const mine = await fetchFirst(assignedTo(accountId, { wf_step: "review" }));
      if (mine) return mine;

      // Priority 2: unassigned, wf_step = review
      return await fetchFirst(unassigned({ wf_step: "review" }));
    }

    return null;
  }

  // ── Owner-like (project_owner, org_owner, admin) ──────────────────────
  if (submittedEntryWfStep === "annotate") {
    // Priority 1: assigned to me, wf_step = annotate
    const mine = await fetchFirst(assignedTo(accountId, { wf_step: "annotate" }));
    if (mine) return mine;

    // Priority 2: unassigned, wf_step = annotate
    return await fetchFirst(unassigned({ wf_step: "annotate" }));
  }

  if (submittedEntryWfStep === "review") {
    // Priority 1: assigned to me, wf_step = review
    const mine = await fetchFirst(assignedTo(accountId, { wf_step: "review" }));
    if (mine) return mine;

    // Priority 2: unassigned, wf_step = review
    return await fetchFirst(unassigned({ wf_step: "review" }));
  }

  return null;
}