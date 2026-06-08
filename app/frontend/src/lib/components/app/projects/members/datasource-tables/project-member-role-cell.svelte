<script lang="ts">
  import { TriangleAlertIcon } from "@lucide/svelte";

  import Can from "@/security/can.svelte";
  import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import AccountEntries from "@/components/app/projects/entries/account-entries.svelte";
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
      annotator:
        "will no longer be able to review entries and any review entries on these datasets currently assigned to this account will be unassigned.",
    },
    project_owner: {
      reviewer: "will lose full control of this project.",
      annotator:
        "will lose full control of this project and any review entries on these datasets currently assigned to this account will be unassigned.",
    },
  };

  // Scenarios where the assigned-entry dataset list must be shown
  const scenariosNeedingDatasets = new Set<string>(["reviewer→annotator", "project_owner→annotator"]);

  // Variables
  let selectedRole: ProjectMemberRole = $state(projectMember.role);
  let selectResetKey: number = $state(0);
  let pendingRole: ProjectMemberRole | null = $state(null);
  let openConfirmModal: boolean = $state(false);

  let selectedRoleLabel = $derived(projectMemberRoles.find((r) => r.value === selectedRole)?.label ?? selectedRole);
  let pendingRoleLabel = $derived(projectMemberRoles.find((r) => r.value === pendingRole)?.label ?? pendingRole);
  let warningMessage = $derived(pendingRole ? (warningMessages[selectedRole]?.[pendingRole] ?? null) : null);
  let needsDatasets = $derived(pendingRole ? scenariosNeedingDatasets.has(`${selectedRole}→${pendingRole}`) : false);

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
    selectResetKey++;
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

      {#if warningMessage}
        <div
          class="mt-3 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400"
        >
          <TriangleAlertIcon class="mt-0.5 size-4 shrink-0" />
          <div>
            <span><strong>{projectMember.email}</strong> {warningMessage}</span>

            {#if needsDatasets}
              <div class="hidden has-[+div:not(:empty)]:block">
                <hr class="my-2 border-amber-300 dark:border-amber-500/40" />
              </div>
              <div class="[&>div]:!text-current">
                <AccountEntries accountId={projectMember.account_id} projectId={projectMember.project_id} />
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {/snippet}
  </ConfirmModal>
</Can>
