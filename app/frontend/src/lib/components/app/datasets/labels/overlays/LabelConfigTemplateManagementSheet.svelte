<script lang="ts">
  import { ArrowDownIcon, GalleryVerticalEndIcon, SaveIcon, Trash2Icon } from "@lucide/svelte";

  import * as Sheet from "$lib/components/ui/sheet";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import LabelConfigEditor from "@/components/app/datasets/labels/label-config-editor.svelte";
  import DatasetModalityBadge from "@/components/app/datasets/badges/DatasetModalityBadge.svelte";
  import EditableTextField from "@/components/app/forms/fields/editable-text/EditableTextField.svelte";
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { LabelConfigController } from "@/components/app/datasets/labels/label-config-controller.svelte";
  import {
    labelConfigTemplateDataSource,
    LabelConfigTemplateRecord,
  } from "@/data/model/dataset/label-config-template/record";
  import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";
  import { refetches } from "@/utils/refetch";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { showActionFailedToast } from "@/utils/error/error.toasts";

  import type { ModalityShapes } from "@/data/model/setting/plugin/types";
  import type { IConfig } from "@/plugin/v2/types";
  import type { Resource, Scope } from "@/security/types";

  interface Props {
    open: boolean;
    /** Dataset modality used to scope the template picker to matching templates. */
    datasetModality: string;
    onApply?: (config: IConfig) => void;
    onMutated?: (templates: LabelConfigTemplateRecord[]) => void;
  }
  let { open = $bindable(), datasetModality, onApply, onMutated }: Props = $props();

  const resource: Resource = "dataset:label_config_templates";
  const permission: { resource: Resource; scopes: Scope[] } = {
    resource,
    scopes: ["as_org_owner", "as_user"],
  };

  const controller = new LabelConfigController();
  let selectedTemplateId = $state<string | null>(null);
  let selectedTemplateName = $state<string>("");
  let modality = $state("");
  let shapes = $state<ModalityShapes>({});
  let saving = $state(false);
  let loaded = $state(false);
  let templates = $state<LabelConfigTemplateRecord[]>([]);
  let openConfirmDeleteModal = $state(false);

  const isSelected = $derived(selectedTemplateId !== null);
  const templatesIsEmpty = $derived(templates.length === 0);

  /** Templates carry no modality field; derive it from the config keys
   *  ("{modality}:{shapeKey}"), ignoring the special "entry:*" keys. */
  function deriveModality(config: IConfig): string {
    const key = Object.keys(config).find((k) => !k.startsWith("entry:"));
    return key ? key.split(":")[0] : "";
  }

  async function loadTemplates() {
    try {
      const res = await labelConfigTemplateDataSource.list({
        fields: { [LabelConfigTemplateRecord.type]: ["name"] },
        filters: { modality: datasetModality },
      });
      templates = res.data;
    } catch (error) {
      showActionFailedToast(error);
    }
  }

  async function refreshSheetData() {
    await loadTemplates();
    onMutated?.(templates);
    if (selectedTemplateId) await loadTemplate(selectedTemplateId);
  }

  async function loadTemplate(id: string | number | null) {
    selectedTemplateId = id === null ? null : String(id);
    loaded = false;
    if (selectedTemplateId === null) return;

    try {
      const res = await labelConfigTemplateDataSource.get(selectedTemplateId);
      selectedTemplateName = res.data.name;
      controller.load(res.data.labeling_configuration);
      modality = deriveModality(res.data.labeling_configuration);
      shapes = modality ? (await pluginsBackendDataSource.showModality(modality)).shapes : {};
      loaded = true;
    } catch (error) {
      showActionFailedToast(error);
    } finally {
      //
    }
  }

  async function saveChanges() {
    if (!selectedTemplateId) return;
    saving = true;
    try {
      const cleaned = controller.getCleanedConfig();
      await labelConfigTemplateDataSource.update(selectedTemplateId, {
        attributes: {
          name: selectedTemplateName,
          labeling_configuration: cleaned,
        },
      });
      controller.markSaved(cleaned);
      $refetches.labelConfigTemplates.list = new Date();
      showToast.success({ title: "Template updated", description: "The changes have been saved." });
    } catch (error) {
      showActionFailedToast(error);
    } finally {
      saving = false;
    }
  }

  async function renameTemplate(newName: string) {
    if (!selectedTemplateId) return;
    try {
      await labelConfigTemplateDataSource.update(selectedTemplateId, {
        attributes: { name: newName },
      });
      selectedTemplateName = newName;
      $refetches.labelConfigTemplates.list = new Date();
      showToast.success({ title: "Template renamed" });
    } catch (error) {
      showActionFailedToast(error);
    }
  }

  async function deleteTemplate() {
    if (!selectedTemplateId) return;
    try {
      await labelConfigTemplateDataSource.delete(selectedTemplateId);
      selectedTemplateId = null;
      loaded = false;
      openConfirmDeleteModal = false;
      $refetches.labelConfigTemplates.list = new Date();
      showToast.success({ title: "Template deleted", description: "The template has been deleted." });
    } catch (error) {
      showActionFailedToast(error);
    }
  }

  function applyTemplate() {
    onApply?.(controller.getCleanedConfig());
    open = false;
  }
</script>

{#snippet SingleSelectTemplateField()}
  <SingleSelectDatasourceField
    name="{resource}.id"
    class="max-w-64"
    displayKey="name"
    searchable
    searchKeyWithOperation="name__match"
    placeholder="Select template"
    valueKey="id"
    dataSource={labelConfigTemplateDataSource}
    listOptions={{
      sort: ["name", "created_at"],
      filters: { modality: datasetModality },
    }}
    value={selectedTemplateId}
    onSelected={loadTemplate}
  />
{/snippet}

<Sheet.Root bind:open>
  <Sheet.Content class="max-w-[85vw] min-w-[85vw]">
    <Sheet.Header class="flex-row items-center gap-4">
      {#key $refetches.labelConfigTemplates.list}
        {@render SingleSelectTemplateField()}
      {/key}

      <DatasetModalityBadge modality={datasetModality} />
    </Sheet.Header>

    {#key $refetches.labelConfigTemplates.list}
      {#await refreshSheetData() then}
        <div class="flex h-full flex-col gap-4 px-4 pb-4">
          {#if isSelected && loaded}
            <section class="flex items-center">
              <EditableTextField
                inputClass="min-w-80"
                value={selectedTemplateName}
                onSave={renameTemplate}
                placeholder="Untitled"
              />

              <div class="ml-auto flex items-center gap-4">
                <Button
                  variant="destructive-outline"
                  disabled={!loaded}
                  onclick={() => (openConfirmDeleteModal = true)}
                >
                  <Trash2Icon />
                  Delete
                </Button>

                <Button
                  variant="outline"
                  loading={saving}
                  loadingLabel="Saving"
                  disabled={!loaded || !controller.hasUnsavedChanges}
                  onclick={saveChanges}
                >
                  <SaveIcon />
                  {controller.hasUnsavedChanges ? "Save Changes" : "Saved"}
                </Button>

                <Button disabled={!loaded} onclick={applyTemplate}>
                  <ArrowDownIcon />
                  Apply This Template
                </Button>
              </div>
            </section>
          {/if}

          <section class="h-full">
            {#if loaded}
              <LabelConfigEditor {modality} {shapes} {controller} {permission} />
            {:else}
              <div class="flex h-full items-center justify-center">
                <ResponseBlock
                  icon={GalleryVerticalEndIcon}
                  title={templatesIsEmpty ? "No Templates Yet" : "No Template Selected"}
                  description={templatesIsEmpty
                    ? "You haven't created any label config templates. Build a configuration, then use “Save as a template to reuse it across datasets."
                    : "Select a label configuration template to view, edit, or apply it."}
                >
                  {#snippet actions()}
                    {#if !templatesIsEmpty}
                      {#key $refetches.labelConfigTemplates.list}
                        {@render SingleSelectTemplateField()}
                      {/key}
                    {/if}
                  {/snippet}
                </ResponseBlock>
              </div>
            {/if}
          </section>
        </div>
      {/await}
    {/key}
  </Sheet.Content>
</Sheet.Root>

<ConfirmModal
  title="Delete Template"
  description={`Are you sure you want to delete this template "${selectedTemplateName}"? This action cannot be undone.`}
  confirmLabel="Yes, Delete"
  onConfirm={deleteTemplate}
  bind:open={openConfirmDeleteModal}
/>
