<script lang="ts">
  import { goto } from "$app/navigation";

  import Button from "@/components/ui/button/button.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import ProjectFormModal from "@/components/app/projects/overlays/project-form-modal.svelte";

  import { EllipsisVerticalIcon, SquarePenIcon, Trash2Icon } from "@lucide/svelte";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { refetches } from "@/utils/refetch";

  import type { DropdownMenuItemBaseProps } from "@/components/app/dropdown-menu/dropdown-menu.types";

  // Props
  interface Props {
    projectId: string;
  }
  let { projectId }: Props = $props();

  // Variables
  const menus: DropdownMenuItemBaseProps[] = [
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
  ];

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
    goto("/projects");
    $refetches.projects.list++;
    openConfirmDeleteProjectModal = false;
  }
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button variant="ghost" size="icon" {...props}>
        <EllipsisVerticalIcon class="size-4" />
      </Button>
    {/snippet}
  </DropdownMenuTrigger>

  <DropdownMenuContent align="end">
    <DropdownMenuGroup>
      {#each menus as { label, icon: Icon, action }}
        <DropdownMenuItem onclick={action}>
          <Icon class="size-4" />
          {label}
        </DropdownMenuItem>
      {/each}
    </DropdownMenuGroup>
  </DropdownMenuContent>
</DropdownMenu>

<ProjectFormModal title="Project" action="update" {projectRecord} bind:open={openEditProjectFormModal} />

<ConfirmModal
  title="Delete Project"
  description="Are you sure you want to delete this project?"
  onConfirm={deleteProject}
  bind:open={openConfirmDeleteProjectModal}
></ConfirmModal>
