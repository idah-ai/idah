<script lang="ts">
  import { page } from "$app/state";
  import { PlusIcon } from "@lucide/svelte";

  import ProjectMemberFormModal from "@/components/app/projects/members/overlays/project-member-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  // Variables
  let projectId = page.params.projectId as string;
  let openNewProjectMemberFormModal: boolean = $state(false);

  // Functions
  function openNewProjectMemberModal(): void {
    openNewProjectMemberFormModal = true;
  }
</script>

<Can
  action="create"
  resource="dataset:project_members"
  scopes={[
    "as_org_owner",
    {
      as_user: {
        projectId,
        projectMemberRoles: ["project_owner"],
      },
    },
  ]}
>
  <Button onclick={openNewProjectMemberModal}>
    <PlusIcon />
    Invite Members
  </Button>

  <ProjectMemberFormModal action="create" title="Members" bind:open={openNewProjectMemberFormModal} />
</Can>
