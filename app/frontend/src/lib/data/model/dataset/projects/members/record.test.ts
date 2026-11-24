import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearAllCache, getCache, setCache } from "@/data/Cache";
import {
  projectMembersBackendDataSource,
  projectMembersBasePath,
} from "@/data/model/dataset/projects/members/record";

const memberData = {
  type: "dataset:project_members",
  id: "member-1",
  attributes: {
    project_id: "project-1",
    account_id: 1,
    name: null,
    email: "new@example.com",
    role: "annotator",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
};

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({ status, json: () => Promise.resolve(body) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  // A list() of the members table cached under the index key.
  setCache(projectMembersBasePath, "list-signature", { data: [] });
});

afterEach(() => {
  clearAllCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("projectMembersBackendDataSource.invite", () => {
  it("clears the cached member lists on success", async () => {
    stubFetch(201, { data: [memberData] });

    await projectMembersBackendDataSource.invite({
      project_id: "project-1",
      members: [{ email: "new@example.com", role: "annotator" }],
    });

    expect(getCache(projectMembersBasePath, "list-signature")).toBeUndefined();
  });

  it("keeps the cache when the backend rejects the batch", async () => {
    stubFetch(422, { errors: [{ status: "422", title: "Invalid", source: { pointer: "/members/0" } }] });

    await expect(
      projectMembersBackendDataSource.invite({
        project_id: "project-1",
        members: [{ email: "bad", role: "annotator" }],
      }),
    ).rejects.toBeDefined();

    expect(getCache(projectMembersBasePath, "list-signature")).toBeDefined();
  });
});

describe("projectMembersBackendDataSource.resend_invitation", () => {
  it("clears the cached member lists on success", async () => {
    stubFetch(200, { data: memberData });

    await projectMembersBackendDataSource.resend_invitation({ id: "member-1" });

    expect(getCache(projectMembersBasePath, "list-signature")).toBeUndefined();
  });
});
