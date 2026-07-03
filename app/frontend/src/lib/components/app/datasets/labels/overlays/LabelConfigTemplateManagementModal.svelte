<script lang="ts">
  import { ArrowDownIcon, SaveIcon, Trash2Icon } from "@lucide/svelte";

  import * as Dialog from "$lib/components/ui/dialog";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import LabelConfigEditor from "@/components/app/datasets/labels/label-config-editor.svelte";
  import { LabelConfigController } from "@/components/app/datasets/labels/label-config-controller.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { labellingConfigurationTemplateDataSource } from "@/data/model/dataset/labelling-configuration-template/record";
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
  let loading = $state(false);
  let saving = $state(false);
  let loaded = $state(false);

  /** Templates carry no modality field; derive it from the config keys
   *  ("{modality}:{shapeKey}"), ignoring the special "entry:*" keys. */
  function deriveModality(config: IConfig): string {
    const key = Object.keys(config).find((k) => !k.startsWith("entry:"));
    return key ? key.split(":")[0] : "";
  }

  async function loadTemplate(id: string | number | null) {
    selectedTemplateId = id === null ? null : String(id);
    loaded = false;
    if (selectedTemplateId === null) return;

    loading = true;
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
      loading = false;
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

  async function deleteTemplate() {
    if (!selectedTemplateId) return;
    try {
      await labellingConfigurationTemplateDataSource.delete(selectedTemplateId);
      selectedTemplateId = null;
      loaded = false;
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

<Dialog.Root bind:open>
  <Dialog.Content class="max-h-[90vh] max-w-[95vw] min-w-[95vw]">
    <Dialog.Header>
      <Dialog.Title>Select Template</Dialog.Title>
    </Dialog.Header>

    <section class="flex">
      <div class="flex items-end gap-4">
        <SingleSelectDatasourceField
          name="{resource}.id"
          class="min-w-64"
          displayKey="name"
          searchable
          searchKeyWithOperation="name__match"
          placeholder="Select template"
          valueKey="id"
          dataSource={labellingConfigurationTemplateDataSource}
          value={selectedTemplateId}
          onSelected={loadTemplate}
        />

        {#if loaded}
          <InputField
            name="{resource}.name"
            class="min-w-64"
            label="Name"
            placeholder="Template name"
            bind:value={name}
          />
        {/if}
      </div>

      <div class="ml-auto flex items-center gap-4">
        <Button variant="destructive-outline" disabled={!loaded} onclick={deleteTemplate}>
          <Trash2Icon />
          Delete
        </Button>

        <Button variant="outline" loading={saving} loadingLabel="Saving" disabled={!loaded} onclick={saveChanges}>
          <SaveIcon />
          Save Changes
        </Button>

        <Button disabled={!loaded} onclick={applyTemplate}>
          <ArrowDownIcon />
          Apply This Template
        </Button>
      </div>
    </section>

    <section>
      {#if loaded}
        <LabelConfigEditor {modality} {shapes} {controller} {permission} />
      {:else}
        <ResponseBlock
          title="No Template Selected"
          description="Select a labelling configuration template to view and edit it"
        />
      {/if}
    </section>
  </Dialog.Content>
</Dialog.Root>
