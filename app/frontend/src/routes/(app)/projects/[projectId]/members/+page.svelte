<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { getContext } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import ProjectMemberFormModal from "@/components/app/projects/members/overlays/project-member-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { projectMemberColumns } from "@/components/app/projects/members/datasource-tables/project-member-columns";
  import { refetches } from "@/utils/refetch";
  import { PlusIcon } from "@lucide/svelte";

  import { homeBreadcrumb, projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

  // Contexts
  const project: ProjectRecord = getContext("project");

  pageBreadcrumbsStore.set([
    homeBreadcrumb,
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${project.id}/members`) },
    { label: "Members" },
  ]);

  // Variables
  let projectId: string | undefined = $derived(page.params.projectId);
  let openNewProjectMemberFormModal: boolean = $state(false);

  // Functions
  function openNewProjectMemberModal(): void {
    openNewProjectMemberFormModal = true;
  }
</script>

{#snippet InviteMemberButton()}
  <Button onclick={openNewProjectMemberModal}>
    <PlusIcon class="size-4"></PlusIcon>
    Invite Members
  </Button>
{/snippet}

{#key $refetches.projectMembers.list}
  <DatasourceTable
    id="project-members-{projectId}"
    name="member"
    title="Members"
    refetchKey="projectMembers"
    columns={projectMemberColumns}
    dataSource={projectMembersBackendDataSource}
    listOptions={{
      filters: {
        project_id: projectId,
      },
    }}
  >
    {#snippet actions()}
      {@render InviteMemberButton()}
    {/snippet}

    {#snippet addNewRecordButton()}
      {@render InviteMemberButton()}
    {/snippet}
  </DatasourceTable>
{/key}

<ProjectMemberFormModal action="create" title="Members" bind:open={openNewProjectMemberFormModal} />
