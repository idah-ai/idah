import z from "zod";
import { projectMemberAccess } from "@/data/model/dataset/projects/members/record";

export const projectMemberSchema = z.object({
  project_id: z.uuid(),

  account_id: z.number(),

  name: z.string().nullable(),
  email: z.email("Make sure to provide a valid email address."),
  access: z.enum(projectMemberAccess.map((access) => access.value)),

  invited_by_id: z.number(),

  created_at: z.string().transform((str) => new Date(str)),
  updated_at: z.string().transform((str) => new Date(str)),
});

export const createMultipleProjectMembersSchema = z
  .array(projectMemberSchema.pick({ email: true, access: true }))
  .min(1);
