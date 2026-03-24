import { z } from "zod";

export const apiKeySchema = z.object({
  name: z.string("Api Key name is required.").min(3, "Api Key name must be at least 3 characters."),

  scope_type: z.string("Scope type is required."),
  scope_value: z.string().array().min(1, "At least 1 scope value is required."),
  permissions: z.string().array().min(1, "At least 1 permission is required."),
  expires_at: z.coerce.date().nullable().default(null),
});

export const createApiKeySchema = apiKeySchema.pick({
  name: true,
  scope_type: true,
  scope_value: true,
  permissions: true,
  expires_at: true,
});

export const updateApiKeySchema = apiKeySchema.pick({
  name: true,
  expires_at: true,
});
