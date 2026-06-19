import type { ProjectMemberRole } from "@/data/model/dataset/projects/members/record";

export interface AssignProjectMemberType {
  email: string;
  role: ProjectMemberRole | null;
  errors?: string[];
}
