import { z } from "zod";

export const apiKeySchema = z.object({
  name: z.string("Api Key name is required.").min(3, "Api Key name must be at least 3 characters."),

  scope_type: z.string("Scope type is required."),
  scope_value: z.string().array(),
  permissions: z.string().array(),
  expires_at: z.coerce.date().nullable().default(null),
});

export const createApiKeySchema = apiKeySchema
  .pick({
    name: true,
    scope_type: true,
    scope_value: true,
    permissions: true,
    expires_at: true,
  })
  .superRefine((data, ctx) => {
    if (data.scope_type === "all") return;

    if (data.scope_value.length === 0) {
      ctx.addIssue({
        path: ["scope_value"],
        code: z.ZodIssueCode.custom,
        message: "Please select at least 1 scope.",
      });
    }

    if (data.permissions.length === 0) {
      ctx.addIssue({
        path: ["permissions"],
        code: z.ZodIssueCode.custom,
        message: "Please select at least 1 permission.",
      });
    }
  });
export const updateApiKeySchema = apiKeySchema.pick({
  name: true,
  expires_at: true,
});
