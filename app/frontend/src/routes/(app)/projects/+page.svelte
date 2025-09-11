<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import DataTable from "@/components/app/data-table/data-table.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import ProjectFormModal from "@/components/app/projects/overlays/project-form-modal.svelte";
  import { PlusIcon } from "@lucide/svelte";

  import { projectBreadcrumb } from "@/components/app/page/page-breadcrumb.constants";
  import { projectColumns } from "@/components/app/projects/data-tables/project-columns";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { refetches } from "@/utils/refetch";

  import type { PageBreadcrumbItem } from "@/components/app/page/page-breadcrumb.svelte";
  import type { CollectionResponse } from "@/data/model/types";
  import type { Hash } from "@/utils/types";
  import type { Record } from "@/data/model/Record";

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

<PageProvider name="projects" {breadcrumbs}>
  <PageHeader title="Projects">
    {#snippet actions()}
      <Button onclick={openNewProjectFormModal}>
        <PlusIcon class="size-4" />
        New Project
      </Button>
    {/snippet}
  </PageHeader>

  {#key $refetches.projects.list}
    <DataTable
      id="projects"
      name="project"
      columns={projectColumns}
      dataSource={projectsBackendDataSource}
      listOptions={{
        fields: {
          "dataset:projects": ["name", "description", "updated_at"],
        },
        sort: ["-created_at"],
      }}
      onNewRecord={openNewProjectFormModal}
      {onLoadSetContexts}
    />
  {/key}
</PageProvider>

<ProjectFormModal title="Project" action="create" bind:open={openNewProjectModal} />
