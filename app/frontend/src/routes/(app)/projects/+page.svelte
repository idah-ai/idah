<script lang="ts">
  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import ProjectFormModal from "@/components/app/projects/overlays/project-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { PlusIcon } from "@lucide/svelte";

  import { projectBreadcrumb } from "@/components/app/page/page-breadcrumb.constants";
  import { projectColumns } from "@/components/app/projects/datasource-tables/project-columns";
  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { refetches } from "@/utils/refetch";

  import type { PageBreadcrumbItem } from "@/components/app/page/page-breadcrumb.svelte";
  import type { Record } from "@/data/model/Record";
  import type { CollectionResponse } from "@/data/model/types";
  import type { Hash } from "@/utils/types";

  // Variables
  let openNewProjectModal: boolean = $state(false);
  let breadcrumbs: PageBreadcrumbItem[] = $state([projectBreadcrumb]);

  // Functions
  function openNewProjectFormModal(): void {
    openNewProjectModal = true;
  }

  async function onLoadSetContexts<T extends Record = ProjectRecord>(response: CollectionResponse<T>): Promise<Hash> {
    /** Fetch related datasets from projectIds */
    const projectIds = Array.from(new Set(response.data.map((project) => project.id)));
    const datasetsRes = await datasetsBackendDataSource.list({
      fields: {
        "dataset:datasets": ["labels"],
        "dataset:projects": [],
      },
      filters: {
        project_id__in: projectIds,
      },
      included: ["project"],
    });

    return { datasets: datasetsRes.data };
  }
</script>

{#snippet AddNewProjectButton()}
  <Button onclick={openNewProjectFormModal}>
    <PlusIcon class="size-4"></PlusIcon>
    New Project
  </Button>
{/snippet}

<PageProvider name="projects" {breadcrumbs}>
  <PageHeader title="Projects">
    {#snippet actions()}
      {@render AddNewProjectButton()}
    {/snippet}
  </PageHeader>

  {#key $refetches.projects.list}
    <DatasourceTable
      id="projects"
      name="project"
      refetchKey="projects"
      columns={projectColumns}
      dataSource={projectsBackendDataSource}
      listOptions={{
        fields: {
          "dataset:projects": ["name", "description", "created_at"],
        },
        sort: ["-created_at"],
      }}
      {onLoadSetContexts}
    >
      {#snippet addNewRecordButton()}
        {@render AddNewProjectButton()}
      {/snippet}
    </DatasourceTable>
  {/key}
</PageProvider>

<ProjectFormModal title="Project" action="create" bind:open={openNewProjectModal} />
