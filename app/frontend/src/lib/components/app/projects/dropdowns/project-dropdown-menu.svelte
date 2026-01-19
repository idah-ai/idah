<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { SquarePenIcon, Trash2Icon } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import ProjectFormModal from "@/components/app/projects/overlays/project-form-modal.svelte";

  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { authStatus } from "@/security/AuthContext";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import type { DropdownMenuContentAlignment, IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { ProjectMemberScope } from "@/security/types";

  // Props
  interface Props {
    projectId: string;
    align?: DropdownMenuContentAlignment;
  }
  let { projectId, align = "center" }: Props = $props();

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
          hidden: !canDeleteProject,
          action: () => {
            openConfirmDeleteProjectModal = true;
          },
        },
      ],
    },
  });

  let projectRecord: ProjectRecord | undefined = $state(undefined);
  let openEditProjectFormModal: boolean = $state(false);
  let openConfirmDeleteProjectModal: boolean = $state(false);

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
        "datasets:projects": ["name", "description", "organization_id"],
      },
      noCache: true,
    });
  }

  async function deleteProject(): Promise<void> {
    try {
      await projectsBackendDataSource.delete(projectId, { showErrorToast: false });

      openConfirmDeleteProjectModal = false;
      $refetches.projects.list = new Date();
      goto(resolve("/projects"));
      toast.success("Project deleted", {
        description: `The project "${projectRecord?.name}" has been deleted.`,
      });
    } catch (error) {
      showActionFailedToast(error);
    }
  }
</script>

{#if canUpdateProject || canDeleteProject}
  <DropdownMenus {menus} {align} />

  <ProjectFormModal title="Project" action="update" {projectRecord} bind:open={openEditProjectFormModal} />

  <ConfirmModal
    title="Delete Project"
    description="Are you sure you want to delete this project?"
    onConfirm={deleteProject}
    bind:open={openConfirmDeleteProjectModal}
  />
{/if}
