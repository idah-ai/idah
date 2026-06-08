<script lang="ts">
  import Can from "@/security/can.svelte";
  import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import ProjectMemberRoleBadge from "@/components/app/projects/members/badges/project-member-role-badge.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import {
    ProjectMemberRecord,
    projectMemberRoles,
    projectMembersBackendDataSource,
    type ProjectMemberRole,
  } from "@/data/model/dataset/projects/members/record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: projectMember }: DataTableCellBaseProps<ProjectMemberRecord> = $props();

  // Variables
  let selectedRole: ProjectMemberRole = $state(projectMember.role);
  let pendingRole: ProjectMemberRole | null = $state(null);
  let openConfirmModal: boolean = $state(false);

  let pendingRoleLabel = $derived(projectMemberRoles.find((r) => r.value === pendingRole)?.label ?? pendingRole);
  let selectedRoleLabel = $derived(projectMemberRoles.find((r) => r.value === selectedRole)?.label ?? selectedRole);

  // Functions
  function onRoleChange(value: string): void {
    if (value === selectedRole) return;
    pendingRole = value as ProjectMemberRole;
    openConfirmModal = true;
  }

  async function confirmRoleChange(): Promise<void> {
    if (!pendingRole) return;

    const newRole = pendingRole;
    pendingRole = null;

    try {
      await projectMembersBackendDataSource.update(
        projectMember.id,
        { attributes: { role: newRole } },
        { showErrorToast: false },
      );

      selectedRole = newRole;
      $refetches.projectMembers.list = new Date();
      showToast.success({
        title: "Member role updated",
        description: `"${projectMember.email}" is now a ${projectMemberRoles.find((r) => r.value === newRole)?.label}.`,
      });
    } catch (error) {
      showActionFailedToast(error);
    }
  }

  function cancelRoleChange(): void {
    pendingRole = null;
  }
</script>

<Can
  action="update"
  resource="dataset:project_members"
  scopes={[
    "as_org_owner",
    {
      as_user: {
        projectId: projectMember.project_id,
        projectMemberRoles: ["project_owner"],
      },
    },
  ]}
>
  {#snippet noAccess()}
    <ProjectMemberRoleBadge projectMemberRecord={projectMember} />
  {/snippet}

  <Select type="single" value={selectedRole} onValueChange={onRoleChange}>
    <SelectTrigger size="sm">
      {selectedRoleLabel}
    </SelectTrigger>
    <SelectContent>
      {#each projectMemberRoles as role (role.value)}
        <SelectItem value={role.value} label={role.label} />
      {/each}
    </SelectContent>
  </Select>

  <ConfirmModal
    title="Role Change"
    description=""
    bind:open={openConfirmModal}
    onConfirm={confirmRoleChange}
    onCancel={cancelRoleChange}
  >
    {#snippet confirm()}
      <Button onclick={confirmRoleChange}>Confirm</Button>
    {/snippet}
    {#snippet modalDescription()}
      <p class="text-muted-foreground text-sm">
        Are you sure you want to change <strong>{projectMember.email}</strong>'s role from
        <strong>{selectedRoleLabel}</strong> to <strong>{pendingRoleLabel}</strong>?
      </p>
    {/snippet}
  </ConfirmModal>
</Can>
