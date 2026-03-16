import { z } from "zod";

export const apiKeySchema = z.object({
  name: z.string("Api Key name is required.").min(3, "Api Key name must be at least 3 characters."),

  scope_type: z.string("Scope type is required."),
  permissions: z.array(z.string()).default([]),

  created_at: z.string().transform((str) => new Date(str)),
  updated_at: z.string().transform((str) => new Date(str)),
});

export const createApiKeySchema = apiKeySchema.pick({
  name: true,
  scope_type: true,
});

export const updateApiKeySchema = apiKeySchema.pick({
  name: true,
  scope_type: true,
});
