import { z } from "zod";

export const organizationSchema = z.object({
  name: z.string("Organization name is required.").min(3, "Organization name must be at least 3 characters."),
  created_at: z.string().transform((str) => new Date(str)),
  updated_at: z.string().transform((str) => new Date(str)),
});

export const createOrganizationSchema = organizationSchema.pick({
  name: true,
});

export const updateOrganizationSchema = createOrganizationSchema.pick({
  name: true,
});
