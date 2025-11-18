<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { PlusIcon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import ProjectFormModal from "@/components/app/projects/overlays/project-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { organizationProjectColumns } from "@/components/app/organizations/data-tables/organization-project-columns";
  import { homeBreadcrumb, organizationBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { OrganizationRecord } from "@/data/model/iam/organizations/record";
  import { refetches } from "@/utils/refetch";

  // Contexts
  const organization: OrganizationRecord = getContext("organization");

  // Variables
  let organizationId: string = page.params.organizationId as string;
  let openAddNewProjectModal: boolean = $state(false);

  pageBreadcrumbsStore.set([
    homeBreadcrumb,
    organizationBreadcrumb,
    { label: organization.name, href: resolve(`/organizations/${organizationId}/projects`) },
    { label: "Projects" },
  ]);

  // Functions
  function openAddNewProjectDialog() {
    openAddNewProjectModal = true;
  }
</script>

{#snippet AddNewProjectButton()}
  <Button onclick={openAddNewProjectDialog}>
    <PlusIcon />
    Add Project
  </Button>
{/snippet}

{#key $refetches.projects.list}
  <DatasourceTable
    id="organization-projects-{organizationId}"
    name="project"
    refetchKey="projects"
    columns={organizationProjectColumns}
    dataSource={projectsBackendDataSource}
    listOptions={{
      filters: {
        organization_id: organizationId,
      },
    }}
  >
    {#snippet actions()}
      {@render AddNewProjectButton()}
    {/snippet}

    {#snippet addNewRecordButton()}
      {@render AddNewProjectButton()}
    {/snippet}
  </DatasourceTable>
{/key}

<ProjectFormModal
  title="Project"
  action="create"
  preSelectedOrganizationId={organizationId}
  bind:open={openAddNewProjectModal}
/>
