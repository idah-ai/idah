<script lang="ts">
  import { beforeNavigate, goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { SaveIcon } from "@lucide/svelte";
  import { getContext, onMount } from "svelte";

  import LabelConfigTemplateDropdownMenu from "@/components/app/datasets/labels/dropdown-menus/LabelConfigTemplateDropdownMenu.svelte";
  import LabelConfigEditor from "@/components/app/datasets/labels/label-config-editor.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { LabelConfigController } from "@/components/app/datasets/labels/label-config-controller.svelte";
  import {
    isConfirmModalActive,
    showConfirmModal,
  } from "@/components/app/overlays/modals/confirm-modal.service.svelte";
  import { ConfirmModalChoice, confirmModalResult } from "@/components/app/overlays/modals/confirm-modal.types";
  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";

  import type { ModalityShapes } from "@/data/model/setting/plugin/types";
  import type { ProjectMemberScope, Resource, Scope } from "@/security/types";

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
  let loaded = $state(false);
  // Set right before re-triggering goto() from the modal so beforeNavigate doesn't re-block it.
  let bypassNavigationGuard = false;

  /** Outcomes of the unsaved-changes prompt, beyond the universal cancel. */
  const UnsavedChangesChoice = {
    Save: "save",
    Discard: "discard",
  } as const;

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
    loaded = true;
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

  function leaveTo(url: URL): void {
    bypassNavigationGuard = true;
    // destination captured from SvelteKit's own beforeNavigate event, not a static route pattern.
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- url is already a resolved
    goto(url).finally(() => {
      bypassNavigationGuard = false;
    });
  }

  async function confirmUnsavedChanges(url: URL): Promise<void> {
    const choice = await showConfirmModal({
      title: "Unsaved changes",
      description: "You have unsaved changes. Do you want to save them before leaving the page?",
      actions: [
        { id: UnsavedChangesChoice.Discard, label: "Don't Save", variant: "outline" },
        {
          id: UnsavedChangesChoice.Save,
          label: "Save",
          pendingLabel: "Saving",
          run: async () => {
            await saveLabelConfigChanges();
            // Save failed: keep the prompt up so the user can retry or leave without saving.
            if (controller.hasUnsavedChanges) return confirmModalResult.KeepOpen;
          },
        },
      ],
    });
    if (choice === ConfirmModalChoice.Cancel) return;

    // Navigating inside `run` would run while the modal is still open.
    leaveTo(url);
  }

  // In-app navigation (e.g. clicking to another dataset): cancel and ask before leaving.
  beforeNavigate((navigation) => {
    if (bypassNavigationGuard || !loaded || !controller.hasUnsavedChanges || !navigation.to) return;
    // Already asking. The overlay blocks clicks but not the browser's Back button, so this
    // guard is re-entrant; showConfirmModal() throws if called while a modal is open.
    if (isConfirmModalActive()) return;
    navigation.cancel();
    void confirmUnsavedChanges(navigation.to.url);
  });

  // Tab close / refresh / external navigation: browsers only allow their own generic prompt.
  function handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!loaded || !controller.hasUnsavedChanges) return;
    event.preventDefault();
  }

  onMount(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  });
</script>

{#await fetchData()}
  <PageLoading />
{:then _}
  <PageHeader title="Label">
    {#snippet slotTitle()}
      <div>
        <LabelConfigTemplateDropdownMenu
          {modality}
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

  <LabelConfigEditor {modality} {shapes} {controller} {permission} {datasetId} allowDuplicateToDatasets />
{/await}
