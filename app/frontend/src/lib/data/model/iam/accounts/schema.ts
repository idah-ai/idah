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

const accountFormSchema = accountSchema
  .pick({
    name: true,
    email: true,
    enabled: true,
    role_name: true,
  })
  .extend({
    role_scope: z.object({ org: z.array(z.string()) }).optional(),
  });

const ownerScopeRequired = (account: Partial<z.infer<typeof accountFormSchema>>) =>
  account.role_name !== "org_owner" || !!account.role_scope?.org.length;

const ownerScopeError = { message: "Select at least one organization.", path: ["role_scope"] };

export const createAccountSchema = accountFormSchema.refine(ownerScopeRequired, ownerScopeError);

export const updateAccountSchema = accountFormSchema.partial().refine(ownerScopeRequired, ownerScopeError);
