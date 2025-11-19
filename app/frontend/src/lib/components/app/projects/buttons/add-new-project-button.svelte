<script lang="ts">
  import { page } from "$app/state";
  import { PlusIcon } from "@lucide/svelte";

  import ProjectFormModal from "@/components/app/projects/overlays/project-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  // Variables
  let organizationId: string = page.params.organizationId as string;
  let openAddNewProjectModal: boolean = $state(false);

  // Functions
  function openAddNewProjectDialog() {
    openAddNewProjectModal = true;
  }
</script>

<Button onclick={openAddNewProjectDialog}>
  <PlusIcon />
  Add Project
</Button>

<ProjectFormModal
  title="Project"
  action="create"
  preSelectedOrganizationId={organizationId}
  bind:open={openAddNewProjectModal}
/>
