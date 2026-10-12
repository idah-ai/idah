import { describe, expect, it } from "vitest";

import {
  canAssignAccountRole,
  canAssignProjectRole,
  canManageProjectMember,
  filterAssignableAccountRoles,
  filterAssignableProjectRoles,
  rank,
} from "./roleHierarchy";

describe("rank", () => {
  it("orders the single chain correctly", () => {
    const order = ["user", "annotator", "reviewer", "project_owner", "org_owner", "admin", "system"];
    const ranks = order.map(rank);

    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThan(ranks[i - 1]);
    }
  });

  it("raises on an unknown role", () => {
    expect(() => rank("superuser")).toThrow(/Unknown role/);
  });
});

describe("canAssignAccountRole", () => {
  it("admin can assign admin (exception)", () => {
    expect(canAssignAccountRole("admin", "admin")).toBe(true);
  });

  it("org_owner can assign org_owner (exception)", () => {
    expect(canAssignAccountRole("org_owner", "org_owner")).toBe(true);
  });

  it("admin can assign any lower role", () => {
    expect(canAssignAccountRole("admin", "org_owner")).toBe(true);
    expect(canAssignAccountRole("admin", "user")).toBe(true);
  });

  it("org_owner can assign user but not admin", () => {
    expect(canAssignAccountRole("org_owner", "user")).toBe(true);
    expect(canAssignAccountRole("org_owner", "admin")).toBe(false);
  });

  it("user cannot assign any role", () => {
    expect(canAssignAccountRole("user", "user")).toBe(false);
    expect(canAssignAccountRole("user", "org_owner")).toBe(false);
    expect(canAssignAccountRole("user", "admin")).toBe(false);
  });

  it("cannot assign a role ranked at or above the actor's own (except the exceptions)", () => {
    expect(canAssignAccountRole("org_owner", "org_owner")).toBe(true); // exception
    expect(canAssignAccountRole("admin", "system")).toBe(false);
  });
});

describe("canAssignProjectRole", () => {
  it("project_owner can assign annotator and reviewer but not project_owner", () => {
    const actorRank = rank("project_owner");
    expect(canAssignProjectRole(actorRank, "annotator")).toBe(true);
    expect(canAssignProjectRole(actorRank, "reviewer")).toBe(true);
    expect(canAssignProjectRole(actorRank, "project_owner")).toBe(false);
  });

  it("org_owner can assign project_owner", () => {
    expect(canAssignProjectRole(rank("org_owner"), "project_owner")).toBe(true);
  });

  it("reviewer cannot assign any role", () => {
    expect(canAssignProjectRole(rank("reviewer"), "annotator")).toBe(false);
    expect(canAssignProjectRole(rank("reviewer"), "reviewer")).toBe(false);
  });
});

describe("canManageProjectMember", () => {
  it("project_owner can manage up to and including project_owner", () => {
    const actorRank = rank("project_owner");
    expect(canManageProjectMember(actorRank, "annotator")).toBe(true);
    expect(canManageProjectMember(actorRank, "reviewer")).toBe(true);
    expect(canManageProjectMember(actorRank, "project_owner")).toBe(true);
  });

  it("reviewer cannot manage any member", () => {
    expect(canManageProjectMember(rank("reviewer"), "annotator")).toBe(false);
  });

  it("org_owner manages everything", () => {
    expect(canManageProjectMember(rank("org_owner"), "project_owner")).toBe(true);
  });
});

describe("filterAssignableProjectRoles", () => {
  it("project_owner sees annotator and reviewer only", () => {
    const roles = ["annotator", "reviewer", "project_owner"];
    expect(filterAssignableProjectRoles(rank("project_owner"), roles)).toEqual(["annotator", "reviewer"]);
  });

  it("org_owner sees all project roles", () => {
    const roles = ["annotator", "reviewer", "project_owner"];
    expect(filterAssignableProjectRoles(rank("org_owner"), roles)).toEqual(roles);
  });

  it("reviewer sees none", () => {
    const roles = ["annotator", "reviewer", "project_owner"];
    expect(filterAssignableProjectRoles(rank("reviewer"), roles)).toEqual([]);
  });
});

describe("filterAssignableAccountRoles", () => {
  it("admin sees all account roles", () => {
    const roles = ["user", "org_owner", "admin"];
    expect(filterAssignableAccountRoles("admin", roles)).toEqual(roles);
  });

  it("org_owner sees user and org_owner but not admin", () => {
    const roles = ["user", "org_owner", "admin"];
    expect(filterAssignableAccountRoles("org_owner", roles)).toEqual(["user", "org_owner"]);
  });

  it("user sees none", () => {
    const roles = ["user", "org_owner", "admin"];
    expect(filterAssignableAccountRoles("user", roles)).toEqual([]);
  });
});
