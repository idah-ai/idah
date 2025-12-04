<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";

  import ProjectMemberFormModal from "@/components/app/projects/members/overlays/project-member-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  // Variables
  let openNewProjectMemberFormModal: boolean = $state(false);

  // Functions
  function openNewProjectMemberModal(): void {
    openNewProjectMemberFormModal = true;
  }
</script>

<Button onclick={openNewProjectMemberModal}>
  <PlusIcon />
  Invite Members
</Button>

<ProjectMemberFormModal action="create" title="Members" bind:open={openNewProjectMemberFormModal} />
