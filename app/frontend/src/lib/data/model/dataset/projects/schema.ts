import { z } from "zod";

export const projectSchema = z.object({
  name: z.string("Project name is required.").min(3, "Project name must be at least 3 characters."),

  description: z
    .string("Project description is required.")
    .min(3, "Project description must be at least 3 characters."),

  created_by_id: z.number(),
  created_at: z.string().transform((str) => new Date(str)),
  updated_at: z.string().transform((str) => new Date(str)),
});

export const createProjectSchema = projectSchema.pick({
  name: true,
  description: true,
});

export const updateProjectSchema = createProjectSchema.partial();
