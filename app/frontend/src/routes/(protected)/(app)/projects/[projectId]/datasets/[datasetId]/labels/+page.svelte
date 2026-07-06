<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { SaveIcon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import LabelConfigEditor from "@/components/app/datasets/labels/label-config-editor.svelte";
  import { LabelConfigController } from "@/components/app/datasets/labels/label-config-controller.svelte";
  import LabelConfigTemplateDropdownMenu from "@/components/app/datasets/labels/dropdown-menus/LabelConfigTemplateDropdownMenu.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";

  import type { ModalityShapes } from "@/data/model/setting/plugin/types";
  import type { Resource, Scope, ProjectMemberScope } from "@/security/types";

  // Contexts
  const project: ProjectRecord = getContext("project");
  const dataset: DatasetRecord = getContext("dataset");

  // Variables
  const projectId: string = page.params.projectId as string;
  const datasetId: string = page.params.datasetId as string;

  const controller = new LabelConfigController();
  let saving = $state(false);
  let modality = $state("");
  let shapes = $state<ModalityShapes>({});

  const as_project_owner: { as_user: ProjectMemberScope } = {
    as_user: {
      projectId,
      projectMemberRoles: ["project_owner"],
    },
  };
  const permission: { resource: Resource; scopes: Scope[] } = {
    resource: "dataset:datasets",
    scopes: ["as_org_owner", as_project_owner],
  };

  pageBreadcrumbsStore.set([
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${projectId}/datasets`) },
    { label: "Datasets", href: resolve(`/projects/${projectId}/datasets`) },
    { label: dataset.name, href: resolve(`/projects/${projectId}/datasets/${datasetId}/labels`) },
    { label: "Label Editor" },
  ]);

  // Functions
  async function fetchData(): Promise<void> {
    const datasetRes = await datasetsBackendDataSource.get(datasetId, {
      fields: {
        [DatasetRecord.type]: ["modality", "labeling_configuration"],
      },
    });
    modality = datasetRes.data.modality;

    const showModalityRes = await pluginsBackendDataSource.showModality(modality);
    shapes = showModalityRes.shapes;

    controller.load(datasetRes.data.labeling_configuration);
  }

  async function saveLabelConfigChanges(): Promise<void> {
    saving = true;
    try {
      const updatedDatasetRes = await datasetsBackendDataSource.update(
        datasetId,
        {
          attributes: {
            labeling_configuration: controller.getCleanedConfig(),
          },
        },
        {
          showErrorToast: false,
        },
      );

      controller.markSaved(updatedDatasetRes.data.labeling_configuration);
      showToast.success({
        title: "Label configurations updated",
        description: "The changes has been saved.",
      });
    } catch (error) {
      showActionFailedToast(error);
    } finally {
      saving = false;
    }
  }
</script>

{#await fetchData()}
  <PageLoading />
{:then _}
  <PageHeader title="Label">
    {#snippet slotTitle()}
      <div>
        <LabelConfigTemplateDropdownMenu
          getConfig={() => controller.getCleanedConfig()}
          organizationId={project.organization_id}
          onApply={(config) => controller.apply(config)}
          onSaved={() => controller.markCurrentAsSaved()}
        />
      </div>
    {/snippet}

    {#snippet actions()}
      <Can action="update" resource="dataset:datasets" scopes={["as_org_owner", as_project_owner]}>
        <Button
          class="ml-auto"
          loading={saving}
          loadingLabel="Saving"
          disabled={!controller.hasUnsavedChanges}
          onclick={saveLabelConfigChanges}
        >
          <SaveIcon />
          {controller.hasUnsavedChanges ? "Save Changes" : "Saved"}
        </Button>
      </Can>
    {/snippet}
  </PageHeader>

  <LabelConfigEditor {modality} {shapes} {controller} {permission} allowDuplicateToDatasets />
{/await}
