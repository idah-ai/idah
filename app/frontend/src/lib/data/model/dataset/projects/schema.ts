import { z } from "zod";

export const projectSchema = z.object({
  name: z.string("Project name is required.").min(3, "Project name must be at least 3 characters."),
  organization_id: z.string("Organization is required."),
  created_by_id: z.number(),
  created_at: z.string().transform((str) => new Date(str)),
  updated_at: z.string().transform((str) => new Date(str)),
});

export const createProjectSchema = projectSchema.pick({
  name: true,
  organization_id: true,
});

export const updateProjectSchema = createProjectSchema.partial();
