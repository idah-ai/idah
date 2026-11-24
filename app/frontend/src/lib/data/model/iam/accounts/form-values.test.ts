import { describe, expect, it } from "vitest";

import { getChangedAccountFields, serializeAccountFields } from "./form-values";
import { createAccountSchema, updateAccountSchema } from "./schema";

const owner = {
  name: "Existing owner",
  email: "owner@example.com",
  role_name: "org_owner",
  role_scope: { org: ["1", "2"] },
  enabled: true,
  sso_channel: "sso",
};

describe("account form values", () => {
  it("keeps the saved organization selection and ignores ordering and ID type", () => {
    expect(serializeAccountFields(owner).role_scope).toEqual({ org: ["1", "2"] });
    expect(getChangedAccountFields(owner, { ...owner, role_scope: { org: [2, 1] } })).toEqual({});
  });

  it("sends only scope for a scope-only edit", () => {
    expect(
      getChangedAccountFields(owner, {
        ...owner,
        email: "ignored@example.com",
        sso_channel: null,
        role_scope: { org: ["2", "3"] },
      }),
    ).toEqual({ role_scope: { org: ["2", "3"] } });
  });

  it("clears the old scope when switching away from Organization Owner", () => {
    expect(getChangedAccountFields(owner, { ...owner, role_name: "user" })).toEqual({
      role_name: "user",
      role_scope: { org: [] },
    });
  });

  it("includes the selected scope when promoting a user even if that scope was already stored", () => {
    expect(getChangedAccountFields({ ...owner, role_name: "user" }, owner)).toEqual({
      role_name: "org_owner",
      role_scope: { org: ["1", "2"] },
    });
  });

  it("keeps scope out of an unrelated edit to a non-owner", () => {
    const user = { ...owner, role_name: "user" };
    expect(getChangedAccountFields(user, { ...user, name: "New name" })).toEqual({ name: "New name" });
  });

  it("requires organizations on an Organization Owner invite or assignment", () => {
    expect(createAccountSchema.safeParse(owner).success).toBe(true);
    expect(createAccountSchema.safeParse({ ...owner, role_scope: undefined }).success).toBe(false);
    expect(updateAccountSchema.safeParse({ role_name: "org_owner", role_scope: { org: [] } }).success).toBe(false);
    expect(updateAccountSchema.safeParse({ name: "New name" }).success).toBe(true);
  });
});
