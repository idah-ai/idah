<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { SquarePenIcon, Trash2Icon } from "@lucide/svelte";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import ProjectFormModal from "@/components/app/projects/overlays/project-form-modal.svelte";

  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { refetches } from "@/utils/refetch";

  import type { DropdownMenuContentAlignment, IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Props
  interface Props {
    projectId: string;
    align?: DropdownMenuContentAlignment;
  }
  let { projectId, align = "center" }: Props = $props();

  // Variables
  const menus: IDropdownMenus = {
    actions: {
      items: [
        {
          label: "Edit",
          icon: SquarePenIcon,
          action: async () => {
            const projectRes = await fetchProject();
            projectRecord = projectRes.data;
            openEditProjectFormModal = true;
          },
        },
        {
          label: "Delete",
          icon: Trash2Icon,
          action: () => {
            openConfirmDeleteProjectModal = true;
          },
        },
      ],
    },
  };

  let projectRecord: ProjectRecord | undefined = $state(undefined);
  let openEditProjectFormModal: boolean = $state(false);
  let openConfirmDeleteProjectModal: boolean = $state(false);

  // Functions
  async function fetchProject() {
    return await projectsBackendDataSource.get(projectId, {
      fields: {
        "datasets:projects": ["name", "description"],
      },
      noCache: true,
    });
  }

  async function deleteProject(): Promise<void> {
    await projectsBackendDataSource.delete(projectId);
    goto(resolve("/projects"));
    $refetches.projects.list = new Date();
    openConfirmDeleteProjectModal = false;
  }
</script>

<DropdownMenus {menus} {align} />

<ProjectFormModal title="Project" action="update" {projectRecord} bind:open={openEditProjectFormModal} />

<ConfirmModal
  title="Delete Project"
  description="Are you sure you want to delete this project?"
  onConfirm={deleteProject}
  bind:open={openConfirmDeleteProjectModal}
/>
