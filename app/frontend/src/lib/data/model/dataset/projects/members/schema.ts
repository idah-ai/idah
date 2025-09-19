import z from "zod";
import { projectMemberRoles } from "@/data/model/dataset/projects/members/record";

export const projectMemberSchema = z.object({
  project_id: z.uuid(),

  account_id: z.number(),

  name: z.string().nullable(),
  email: z.email(),
  role: z.enum(Object.values(projectMemberRoles).map((role) => role.value)),

  invited_by_id: z.number(),

  created_at: z.string().transform((str) => new Date(str)),
  updated_at: z.string().transform((str) => new Date(str)),
});

export const createMultipleProjectMembersSchema = z.array(projectMemberSchema.pick({ email: true, role: true })).min(1);
