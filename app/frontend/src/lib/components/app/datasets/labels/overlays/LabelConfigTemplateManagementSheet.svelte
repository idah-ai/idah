<script lang="ts">
  import { onMount } from "svelte";
  import { ArrowDownIcon, GalleryVerticalEndIcon, SaveIcon, Trash2Icon } from "@lucide/svelte";

  import * as Sheet from "$lib/components/ui/sheet";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import LabelConfigEditor from "@/components/app/datasets/labels/label-config-editor.svelte";
  import EditableTextField from "@/components/app/forms/fields/editable-text/EditableTextField.svelte";
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { LabelConfigController } from "@/components/app/datasets/labels/label-config-controller.svelte";
  import {
    labellingConfigurationTemplateDataSource,
    LabellingConfigurationTemplateRecord,
  } from "@/data/model/dataset/labelling-configuration-template/record";
  import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { showActionFailedToast } from "@/utils/error/error.toasts";

  import type { ModalityShapes } from "@/data/model/setting/plugin/types";
  import type { IConfig } from "@/plugin/v2/types";
  import type { Resource, Scope } from "@/security/types";

  interface Props {
    open: boolean;
    onApply?: (config: IConfig) => void;
  }
  let { open = $bindable(), onApply }: Props = $props();

  const resource: Resource = "dataset:labeling_configuration_templates";
  const permission: { resource: Resource; scopes: Scope[] } = {
    resource,
    scopes: ["as_org_owner", "as_user"],
  };

  const controller = new LabelConfigController();
  let selectedTemplateId = $state<string | null>(null);
  let name = $state("");
  let modality = $state("");
  let shapes = $state<ModalityShapes>({});
  let saving = $state(false);
  let loaded = $state(false);
  let templates = $state<LabellingConfigurationTemplateRecord[]>([]);
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
      const res = await labellingConfigurationTemplateDataSource.list({
        fields: { [LabellingConfigurationTemplateRecord.type]: ["name"] },
      });
      templates = res.data;
    } catch (error) {
      showActionFailedToast(error);
    }
  }

  onMount(loadTemplates);

  async function loadTemplate(id: string | number | null) {
    selectedTemplateId = id === null ? null : String(id);
    loaded = false;
    if (selectedTemplateId === null) return;

    try {
      const res = await labellingConfigurationTemplateDataSource.get(selectedTemplateId);
      name = res.data.name;
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
      await labellingConfigurationTemplateDataSource.update(selectedTemplateId, {
        attributes: { name, labeling_configuration: cleaned },
      });
      controller.markSaved(cleaned);
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
      await labellingConfigurationTemplateDataSource.update(selectedTemplateId, {
        attributes: { name: newName },
      });
      name = newName;
      showToast.success({ title: "Template renamed" });
    } catch (error) {
      showActionFailedToast(error);
    }
  }

  async function deleteTemplate() {
    if (!selectedTemplateId) return;
    try {
      await labellingConfigurationTemplateDataSource.delete(selectedTemplateId);
      selectedTemplateId = null;
      loaded = false;
      await loadTemplates();
      showToast.success({ title: "Template deleted" });
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
    dataSource={labellingConfigurationTemplateDataSource}
    listOptions={{
      sort: ["name"],
    }}
    value={selectedTemplateId}
    onSelected={loadTemplate}
  />
{/snippet}

<Sheet.Root bind:open>
  <Sheet.Content class="max-w-[85vw] min-w-[85vw]">
    <Sheet.Header class="flex-row items-center gap-4">
      <Sheet.Title class="shrink-0 ">Select Template</Sheet.Title>

      {@render SingleSelectTemplateField()}
    </Sheet.Header>

    <div class="flex h-full flex-col gap-4 px-4 pb-4">
      {#if isSelected && loaded}
        <section class="flex items-center">
          <EditableTextField
            inputClass="min-w-80"
            value={name}
            onSave={renameTemplate}
            placeholder="Untitled template"
          />

          <div class="ml-auto flex items-center gap-4">
            <Button variant="destructive-outline" disabled={!loaded} onclick={() => (openConfirmDeleteModal = true)}>
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
              Save Changes
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
                ? "You haven't created any labelling configuration templates. Build a configuration, then use “Save as a template” to reuse it across datasets."
                : "Select a labelling configuration template above to view, edit, or apply it."}
            >
              {#snippet actions()}
                {#if !templatesIsEmpty}
                  {@render SingleSelectTemplateField()}
                {/if}
              {/snippet}
            </ResponseBlock>
          </div>
        {/if}
      </section>
    </div>
  </Sheet.Content>
</Sheet.Root>

<ConfirmModal
  title="Delete Template"
  description="Are you sure you want to delete this template? This action cannot be undone."
  confirmLabel="Yes, Delete"
  onConfirm={deleteTemplate}
  bind:open={openConfirmDeleteModal}
/>
