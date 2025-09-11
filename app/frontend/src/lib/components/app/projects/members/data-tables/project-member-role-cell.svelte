<script lang="ts">
  import SingleSelectField from "@/components/app/forms/fields/select/single-select-field.svelte";

  import { humanize } from "@/utils/string";
  import { toast } from "svelte-sonner";
  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";

  import type { DataTableCellBaseProps } from "@/components/app/data-table/data-table.types";

  // Props
  interface Props extends DataTableCellBaseProps<ProjectMemberRecord> {}
  let { record: projectMember }: Props = $props();

  // Variables
  const resource: string = "Resource::Dataset::Projects";

  let projectMemberRole = $derived(projectMember.role);

  // Functions
  async function updateProjectMemberRole(newRole: string): Promise<void> {
    try {
      await projectMembersBackendDataSource.update(projectMember.id, {
        attributes: {
          role: newRole,
        },
      });
      toast.success(`${humanize(newRole)} role assigned to ${projectMember.email}`);
    } catch (error) {
      toast.error("Failed to update project member role");
    }
  }
</script>

<SingleSelectField
  name="{resource}/role"
  class="flex-1"
  placeholder="Select a role"
  choices={[
    { label: "Annotator", value: "annotator" },
    { label: "Reviewer", value: "reviewer" },
    { label: "Project Manager", value: "project_manager" },
    { label: "Admin", value: "Admin" },
  ]}
  required
  searchable
  searchPlaceholder="Search a role"
  onValueChange={updateProjectMemberRole}
  bind:value={projectMemberRole}
/>
