import { z } from "zod";

export const accountSchema = z.object({
  name: z.string("Account name is required.").min(3, "Account name must be at least 3 characters."),

  email: z.email("Make sure to provide a valid email address."),

  sso_channel: z.string().nullable(),

  enabled: z.boolean().default(true),
  role_name: z.string().nullable(),

  joined_at: z
    .string()
    .nullable()
    .transform((str) => (str ? new Date(str) : null)),

  created_at: z.string().transform((str) => new Date(str)),
  updated_at: z.string().transform((str) => new Date(str)),
});

const ownerScopeSchema = z.object({
  role_name: z.string().nullable().optional(),
  role_scope: z
    .object({ org: z.array(z.union([z.string(), z.number()])).optional() })
    .nullable()
    .optional(),
});

const ownerScopeRequired = (account: z.infer<typeof ownerScopeSchema>) =>
  account.role_name !== "org_owner" || !!account.role_scope?.org?.length;
const ownerScopeError = { message: "Select at least one organization.", path: ["role_scope"] };

export const createAccountSchema = accountSchema
  .pick({
    name: true,
    email: true,
    enabled: true,
  })
  .extend(ownerScopeSchema.shape)
  .refine(ownerScopeRequired, ownerScopeError);

export const updateAccountSchema = accountSchema
  .pick({
    name: true,
    email: true,
    enabled: true,
    role_name: true,
  })
  .extend({ role_scope: ownerScopeSchema.shape.role_scope })
  .refine(ownerScopeRequired, ownerScopeError);
