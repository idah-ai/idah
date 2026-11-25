// ---------------------------------------------------------------------------
// Storage targets — pure helpers shared by the admin page and the project form.
// ---------------------------------------------------------------------------

import type { Hash } from "@/utils/types";

/** What the backend's connection test answers. */
export type ConnectionResult = { ok: boolean; error: string | null };

/** The connection test's error codes, said in a way an admin can act on. */
export const connectionErrorMessages: { [code: string]: string } = {
  access_denied:
    "The bucket refused these credentials. Check the access key ID, the secret key and the key's permissions.",
  bucket_not_found: "This bucket doesn't exist at this endpoint. Check its name and region.",
  unreachable: "The endpoint can't be reached from the server. Check the URL and the network.",
  https_required: "The endpoint must use https.",
  invalid_endpoint: "The endpoint isn't a valid URL, such as https://s3.eu-west-1.amazonaws.com.",
  connection_failed: "A test file couldn't be written, read back and deleted in the bucket.",
};

export function connectionErrorMessage(code: string | null | undefined): string {
  if (!code) return "";

  return connectionErrorMessages[code] ?? connectionErrorMessages.connection_failed;
}

const CONNECTION_FAILED_PATTERN = /connection test failed: (\w+)/;

/**
 * The message to show when saving a storage target fails: the connection
 * test's explanation when that is why, otherwise the backend's own message.
 */
export function storageTargetSaveErrorMessage(error: unknown): string {
  const errors = (error as { errors?: Array<{ detail?: string }> } | null)?.errors ?? [];
  const detail = errors.map((e) => e.detail).find(Boolean) ?? "";

  const code = detail.match(CONNECTION_FAILED_PATTERN)?.[1];
  if (code) return connectionErrorMessage(code);

  return detail || "The storage target couldn't be saved. Please try again.";
}

/** Slashes at either end of a prefix would double up in every stored file's key. */
export function normalizePrefix(prefix: string | null | undefined): string {
  return (prefix ?? "").trim().replace(/^\/+|\/+$/g, "");
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function organizationIds(values: unknown): number[] {
  if (!Array.isArray(values)) return [];

  return [...new Set(values.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

/** The attributes to send when creating a target from the form's values. */
export function storageTargetCreateAttributes(draft: Hash): Hash {
  return {
    name: trimmed(draft.name),
    endpoint: trimmed(draft.endpoint),
    region: trimmed(draft.region) || null,
    bucket: trimmed(draft.bucket),
    prefix: normalizePrefix(draft.prefix),
    path_style: Boolean(draft.path_style),
    access_key_id: trimmed(draft.access_key_id),
    secret_access_key: trimmed(draft.secret_access_key),
    organization_ids: organizationIds(draft.organization_ids),
    enabled: Boolean(draft.enabled),
  };
}

/**
 * The attributes to send when updating a target. The location (endpoint,
 * region, bucket, prefix) can't change, so it is never sent; an empty secret
 * keeps the stored one, so it is left out.
 */
export function storageTargetUpdateAttributes(draft: Hash): Hash {
  const attributes: Hash = {
    name: trimmed(draft.name),
    path_style: Boolean(draft.path_style),
    access_key_id: trimmed(draft.access_key_id),
    organization_ids: organizationIds(draft.organization_ids),
    enabled: Boolean(draft.enabled),
  };

  const secret = trimmed(draft.secret_access_key);
  if (secret) attributes.secret_access_key = secret;

  return attributes;
}

/** A new access key ID only works with its own secret key. */
export function secretRequiredForUpdate(draft: Hash, original: { access_key_id?: string | null }): boolean {
  const keyChanged = trimmed(draft.access_key_id) !== (original.access_key_id ?? "");

  return keyChanged && !trimmed(draft.secret_access_key);
}

/** "acme-bucket/idah", or the bucket alone without a prefix. */
export function storageTargetLocation(target: { bucket?: string | null; prefix?: string | null }): string {
  const prefix = normalizePrefix(target.prefix);

  return prefix ? `${target.bucket}/${prefix}` : `${target.bucket ?? ""}`;
}

/** How the stored secret is shown: never the secret, only its last characters. */
export function maskedSecret(hint: string | null | undefined): string {
  return hint ? `••••${hint}` : "••••";
}

/** A project's storage target, as the project show response's meta gives it. */
export type ProjectStorageTargetSummary = {
  id: string;
  name?: string;
  endpoint?: string;
  bucket?: string;
  archived?: boolean;
};

/** Where a project's files are, in words: the target's name, or the platform default. */
export function projectStorageLabel(summary: ProjectStorageTargetSummary | null | undefined): string {
  if (!summary) return "Default platform storage";
  if (summary.archived || !summary.name) return "An archived storage target";

  return summary.bucket ? `${summary.name} (${summary.bucket})` : summary.name;
}

/** The value the "File storage" selector uses for the platform default. */
export const DEFAULT_STORAGE_CHOICE = "default";

/** The storage_target_id to send for the selector's value: none for the default. */
export function storageTargetIdFromChoice(choice: string | number | null | undefined): string | null {
  if (choice === null || choice === undefined || choice === "" || choice === DEFAULT_STORAGE_CHOICE) return null;

  return String(choice);
}
