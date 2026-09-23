<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { SquarePenIcon, Trash2Icon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import ProjectFormModal from "@/components/app/projects/overlays/project-form-modal.svelte";

  import { showConfirmModal } from "@/components/app/overlays/modals/confirm-modal.service.svelte";
  import { ConfirmModalChoice, confirmModalResult } from "@/components/app/overlays/modals/confirm-modal.types";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  import type { DropdownMenuContentAlignment, IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { ProjectMemberScope } from "@/security/types";

  // Props
  interface Props {
    projectId: string;
    align?: DropdownMenuContentAlignment;
  }
  let { projectId, align = "end" }: Props = $props();

  // Variables
  let currentAccount = $authStatus.authContext;
  let canUpdateProject = $state(false);
  let canDeleteProject = $state(false);
  let menus: IDropdownMenus = $derived({
    actions: {
      items: [
        {
          label: "Edit",
          icon: SquarePenIcon,
          hidden: !canUpdateProject,
          action: async () => {
            const projectRes = await fetchProject();
            projectRecord = projectRes.data;
            openEditProjectFormModal = true;
          },
        },
        {
          label: "Delete",
          icon: Trash2Icon,
          destructive: true,
          hidden: !canDeleteProject,
          action: confirmDeleteProject,
        },
      ],
    },
  });

  let projectRecord: ProjectRecord | undefined = $state(undefined);
  let openEditProjectFormModal: boolean = $state(false);

  // Lifecycle
  onMount(async () => {
    await Promise.all([checkRights()]);
    const projectRes = await fetchProject();
    projectRecord = projectRes.data;
  });

  // Functions
  async function checkRights() {
    const as_project_owner: { as_user: ProjectMemberScope } = {
      as_user: {
        projectId,
        projectMemberRoles: ["project_owner"],
      },
    };
    canUpdateProject =
      (await currentAccount?.can("update", "dataset:projects", ["as_org_owner", as_project_owner])) || false;
    canDeleteProject =
      (await currentAccount?.can("delete", "dataset:projects", ["as_org_owner", as_project_owner])) || false;
  }

  async function fetchProject() {
    return await projectsBackendDataSource.get(projectId, {
      fields: {
        [ProjectRecord.type]: ["name", "description", "organization_id"],
      },
      noCache: true,
    });
  }

  async function confirmDeleteProject(): Promise<void> {
    const choice = await showConfirmModal({
      title: "Delete Project",
      description: `Are you sure you want to delete this project "${projectRecord?.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await projectsBackendDataSource.delete(projectId, { showErrorToast: false });

          $refetches.projects.list = new Date();
          showToast.success({
            title: "Project deleted",
            description: `The project "${projectRecord?.name}" has been deleted.`,
          });
        } catch (error) {
          showToast.error({
            title: "Unable to delete project",
            description: error?.errors[0]?.detail || "The action could not be completed, please try again later.",
          });
          return confirmModalResult.KeepOpen;
        }
      },
    });
    if (choice === ConfirmModalChoice.Cancel) return;

    // Navigating inside `onConfirm` would run while the modal is still open.
    goto(resolve("/projects"));
  }
</script>

{#if canUpdateProject || canDeleteProject}
  <DropdownMenus {menus} {align} />

  <ProjectFormModal title="Project" action="update" {projectRecord} bind:open={openEditProjectFormModal} />
{/if}
