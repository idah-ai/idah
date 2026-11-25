import { describe, expect, it, vi } from "vitest";

import { AuthContext } from "./AuthContext";
import { rank } from "./roleHierarchy";

import { projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
import { projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";

import type { Hash } from "@/utils/types";

function buildContext(roleName: string, rights: string[], roleScope: Hash = { org: [] }): AuthContext {
  return new AuthContext({
    id: "1",
    email: "actor@test.com",
    name: "Actor",
    role_name: roleName,
    role_scope: roleScope,
    role_rights: rights,
    exp: 9999999999,
  });
}

describe("AuthContext.canOnProject", () => {
  it("returns false when the actor lacks the right entirely", async () => {
    const ctx = buildContext("org_owner", ["dataset:datasets.read.as_org_owner"]);
    // No "create" right, so even a high rank must not grant it.
    expect(await ctx.canOnProject("create", "dataset:datasets", "p1", "project_owner")).toBe(false);
  });

  it("grants access when the effective rank meets the minimum role", async () => {
    const ctx = buildContext("org_owner", ["dataset:datasets.*.as_org_owner"]);
    vi.spyOn(ctx, "effectiveProjectRank").mockResolvedValue(rank("project_owner"));

    expect(await ctx.canOnProject("create", "dataset:datasets", "p1", "project_owner")).toBe(true);
  });

  it("denies access when the effective rank is below the minimum role", async () => {
    const ctx = buildContext("org_owner", ["dataset:datasets.*.as_org_owner"]);
    // A reviewer membership on a foreign project must NOT grant org_owner powers.
    vi.spyOn(ctx, "effectiveProjectRank").mockResolvedValue(rank("reviewer"));

    expect(await ctx.canOnProject("create", "dataset:datasets", "p1", "project_owner")).toBe(false);
  });

  it("denies access when the actor has no access to the project", async () => {
    const ctx = buildContext("user", ["dataset:datasets.*.as_user"]);
    vi.spyOn(ctx, "effectiveProjectRank").mockResolvedValue(null);

    expect(await ctx.canOnProject("create", "dataset:datasets", "p1", "project_owner")).toBe(false);
  });
});

describe("AuthContext.effectiveProjectRank for an org_owner", () => {
  it("returns org_owner rank when the project's org is in role_scope.org (own org)", async () => {
    const ctx = buildContext("org_owner", ["dataset:project_members.*.as_org_owner"], { org: ["2"] });
    vi.spyOn(projectsBackendDataSource, "get").mockResolvedValue({ data: { organization_id: 2 } } as never);

    expect(await ctx.effectiveProjectRank("p1")).toBe(rank("org_owner"));
  });

  it("falls back to the membership role for a foreign project not in role_scope.org", async () => {
    const ctx = buildContext("org_owner", ["dataset:project_members.*.as_org_owner"], { org: ["2"] });
    vi.spyOn(projectsBackendDataSource, "get").mockResolvedValue({ data: { organization_id: 999 } } as never);
    vi.spyOn(projectMembersBackendDataSource, "list").mockResolvedValue({ data: [{ role: "reviewer" }] } as never);

    expect(await ctx.effectiveProjectRank("p1")).toBe(rank("reviewer"));
  });

  it("returns null for a project with no org coverage and no membership", async () => {
    const ctx = buildContext("org_owner", ["dataset:project_members.*.as_org_owner"], { org: ["2"] });
    vi.spyOn(projectsBackendDataSource, "get").mockResolvedValue({ data: { organization_id: 999 } } as never);
    vi.spyOn(projectMembersBackendDataSource, "list").mockResolvedValue({ data: [] } as never);

    expect(await ctx.effectiveProjectRank("p1")).toBeNull();
  });
});

describe("AuthContext.effectiveProjectRank memoization", () => {
  it("issues one project fetch and one membership fetch for repeated calls on the same project", async () => {
    const ctx = buildContext("user", ["dataset:datasets.*.as_user"]);

    const projectGet = vi
      .spyOn(projectsBackendDataSource, "get")
      .mockResolvedValue({ data: { organization_id: 999 } } as never);
    const membershipList = vi
      .spyOn(projectMembersBackendDataSource, "list")
      .mockResolvedValue({ data: [{ role: "reviewer" }] } as never);

    await ctx.canOnProject("create", "dataset:datasets", "p1", "project_owner");
    await ctx.canOnProject("update", "dataset:datasets", "p1", "project_owner");
    await ctx.effectiveProjectRank("p1");

    expect(projectGet).toHaveBeenCalledTimes(1);
    expect(membershipList).toHaveBeenCalledTimes(1);
  });

  it("recomputes after the cache is cleared", async () => {
    const ctx = buildContext("user", ["dataset:datasets.*.as_user"]);

    const projectGet = vi
      .spyOn(projectsBackendDataSource, "get")
      .mockResolvedValue({ data: { organization_id: 999 } } as never);
    const membershipList = vi
      .spyOn(projectMembersBackendDataSource, "list")
      .mockResolvedValue({ data: [{ role: "reviewer" }] } as never);

    await ctx.effectiveProjectRank("p1");
    ctx.clearEffectiveProjectRankCache();
    await ctx.effectiveProjectRank("p1");

    expect(projectGet).toHaveBeenCalledTimes(2);
    expect(membershipList).toHaveBeenCalledTimes(2);
  });

  it("drops the cache entry when the fetch rejects, so the next call retries", async () => {
    const ctx = buildContext("user", ["dataset:datasets.*.as_user"]);

    const projectGet = vi
      .spyOn(projectsBackendDataSource, "get")
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({ data: { organization_id: 999 } } as never);
    const membershipList = vi
      .spyOn(projectMembersBackendDataSource, "list")
      .mockResolvedValue({ data: [{ role: "reviewer" }] } as never);

    await expect(ctx.effectiveProjectRank("p1")).rejects.toThrow("network");
    // The failed entry was dropped, so this call retries the project fetch.
    await expect(ctx.effectiveProjectRank("p1")).resolves.toBe(rank("reviewer"));

    expect(projectGet).toHaveBeenCalledTimes(2);
    expect(membershipList).toHaveBeenCalledTimes(1);
  });
});
