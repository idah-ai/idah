import type { Hash } from "@/utils/types";

export function serializeAccountFields(source: Hash) {
  return {
    name: source.name,
    role_name: source.role_name,
    enabled: source.enabled,
    role_scope: { org: [...new Set<string>((source.role_scope?.org ?? []).map(String))].sort() },
  };
}

export function getChangedAccountFields(account: Hash | undefined, draft: Hash): Hash {
  if (!account) return {};

  const original = serializeAccountFields(account);
  const current = serializeAccountFields(draft);
  const roleChanged = current.role_name !== original.role_name;
  const attributes: Hash = {};

  for (const field of ["name", "role_name", "enabled"] as const) {
    if (current[field] !== original[field]) attributes[field] = current[field];
  }

  if (current.role_name === "org_owner") {
    if (roleChanged || JSON.stringify(current.role_scope) !== JSON.stringify(original.role_scope)) {
      attributes.role_scope = current.role_scope;
    }
  } else if (roleChanged && original.role_scope.org.length > 0) {
    attributes.role_scope = { org: [] };
  }

  return attributes;
}
