<script lang="ts">
  import Can from "@/security/can.svelte";
  import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
  import ProjectMemberRoleBadge from "@/components/app/projects/members/badges/project-member-role-badge.svelte";
  import RoleChangeWarning from "@/components/app/projects/members/datasource-tables/role-change-warning.svelte";

  import { showConfirmModal } from "@/components/app/overlays/modals/confirm-modal.service.svelte";
  import { ConfirmModalChoice, ConfirmModalResult } from "@/components/app/overlays/modals/confirm-modal.types";
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

  // Role descriptions shown as secondary text in the dropdown
  const roleDescriptions: Record<ProjectMemberRole, string> = {
    project_owner: "Annotate, Review, Manage project",
    reviewer: "Annotate, Review",
    annotator: "Annotate",
  };

  // Warning messages per (from → to) role pair
  const warningMessages: Partial<Record<ProjectMemberRole, Partial<Record<ProjectMemberRole, string>>>> = {
    annotator: {
      reviewer: "will be eligible to review entries.",
      project_owner: "will be granted full control of this project.",
    },
    reviewer: {
      project_owner: "will be granted full control of this project.",
      annotator: "will no longer be able to review entries.",
      // TODO: use this once auto-unassigned is implemented
      // "will no longer be able to review entries and any review entries on these datasets currently assigned to this account will be unassigned.",
    },
    project_owner: {
      reviewer: "will lose full control of this project.",
      annotator: "will lose full control of this project and no longer be able to review entries.",
      // TODO: use this once auto-unassigned is implemented
      // "will no longer be able to review entries and any review entries on these datasets currently assigned to this account will be unassigned.",
    },
  };

  // Scenarios where the assigned-entry dataset list must be shown
  const scenariosNeedingDatasets = new Set<string>(["reviewer→annotator", "project_owner→annotator"]);

  // Variables
  let selectedRole: ProjectMemberRole = $state(projectMember.role);
  let selectResetKey: number = $state(0);

  let selectedRoleLabel = $derived(projectMemberRoles.find((r) => r.value === selectedRole)?.label ?? selectedRole);

  function roleLabel(role: ProjectMemberRole) {
    return projectMemberRoles.find((r) => r.value === role)?.label ?? role;
  }

  // Functions
  function onRoleChange(value: string): void {
    if (value === selectedRole) return;
    void confirmRoleChange(value as ProjectMemberRole);
  }

  async function confirmRoleChange(newRole: ProjectMemberRole): Promise<void> {
    const fromRole = selectedRole;

    const choice = await showConfirmModal({
      title: "Role Change",
      confirmLabel: "Confirm",
      destructive: false,
      content: {
        component: RoleChangeWarning,
        props: {
          email: projectMember.email,
          fromRoleLabel: roleLabel(fromRole),
          toRoleLabel: roleLabel(newRole),
          warningMessage: warningMessages[fromRole]?.[newRole] ?? null,
          needsDatasets: scenariosNeedingDatasets.has(`${fromRole}→${newRole}`),
          accountId: projectMember.account_id,
          projectId: projectMember.project_id,
        },
      },
      onConfirm: async () => {
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
            description: `"${projectMember.email}" is now a ${roleLabel(newRole)}.`,
          });
        } catch (error) {
          showActionFailedToast(error);
          return ConfirmModalResult.KeepOpen;
        }
      },
    });

    // Cancel, Escape or a route change: put the <Select> back on the current role.
    if (choice === ConfirmModalChoice.Cancel) selectResetKey++;
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

  {#key selectResetKey}
    <Select type="single" value={selectedRole} onValueChange={onRoleChange}>
      <SelectTrigger size="sm">
        {selectedRoleLabel}
      </SelectTrigger>
      <SelectContent>
        {#each projectMemberRoles as role (role.value)}
          <SelectItem value={role.value} label={role.label}>
            <div>
              <p>{role.label}</p>
              <p class="text-muted-foreground text-xs">{roleDescriptions[role.value]}</p>
            </div>
          </SelectItem>
        {/each}
      </SelectContent>
    </Select>
  {/key}
</Can>
