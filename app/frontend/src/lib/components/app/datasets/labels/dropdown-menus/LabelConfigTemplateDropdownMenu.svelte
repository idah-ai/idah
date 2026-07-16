<script lang="ts">
  import { onMount } from "svelte";
  import { ArrowDownIcon, ChevronsUpDownIcon, FileIcon, FilePlusIcon, SaveIcon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";
  import ConfirmModal from "@/components/app/overlays/modals/confirm-modal.svelte";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import LabelConfigTemplateSaveModal from "$lib/components/app/datasets/labels/overlays/LabelConfigTemplateSaveModal.svelte";
  import LabelConfigTemplateManagementSheet from "@/components/app/datasets/labels/overlays/LabelConfigTemplateManagementSheet.svelte";

  import {
    LabelConfigTemplateRecord,
    labelConfigTemplateDataSource,
  } from "@/data/model/dataset/label-config-template/record";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  import type { IDropdownMenus, IDropdownMenuItem } from "@/components/app/dropdown-menus/types";
  import type { IConfig } from "@/plugin/v2/types";

  interface Props {
    modality: string;
    getConfig: () => IConfig;
    organizationId: number | string;
    onApply?: (config: IConfig) => void;
    onSaved?: () => void;
  }
  let { modality, getConfig, organizationId, onApply, onSaved }: Props = $props();

  let labelConfigTemplateManagementDialogOpen = $state(false);
  let labelConfigTemplateSaveModalOpen = $state(false);
  let templates = $state<LabelConfigTemplateRecord[]>([]);
  let pendingReplaceTemplate = $state<LabelConfigTemplateRecord | null>(null);
  let openConfirmReplaceModal = $state(false);

  async function loadTemplates() {
    try {
      const res = await labelConfigTemplateDataSource.list({
        fields: { [LabelConfigTemplateRecord.type]: ["name"] },
        filters: { modality },
      });
      templates = res.data;
    } catch (error) {
      showActionFailedToast(error);
    }
  }

  onMount(loadTemplates);

  /** Refresh the dirty flag on the host + keep the Replace list up to date. */
  async function handleSaved() {
    onSaved?.();
    $refetches.labelConfigTemplates.list = new Date();
    await loadTemplates();
  }

  async function replaceTemplate(template: LabelConfigTemplateRecord) {
    try {
      await labelConfigTemplateDataSource.update(
        template.id,
        { attributes: { labeling_configuration: getConfig() } },
        { showErrorToast: false },
      );
      showToast.success({
        title: "Template overwritten",
        description: `The template "${template.name}" has been updated.`,
      });
      await handleSaved();
    } catch (error) {
      showActionFailedToast(error);
    }
  }

  function confirmReplaceTemplate() {
    if (!pendingReplaceTemplate) return;
    replaceTemplate(pendingReplaceTemplate);
    pendingReplaceTemplate = null;
    openConfirmReplaceModal = false;
  }

  const replaceItems = $derived<IDropdownMenuItem[]>(
    templates.length === 0
      ? [{ label: "No templates to overwrite", disabled: true }]
      : templates.map((template) => ({
          label: template.name,
          icon: FileIcon,
          action: () => {
            pendingReplaceTemplate = template;
            openConfirmReplaceModal = true;
          },
        })),
  );

  function updateTemplates(fetchedTemplates: LabelConfigTemplateRecord[]) {
    templates = fetchedTemplates;
  }

  const menus = $derived<IDropdownMenus>({
    actions: {
      items: [
        {
          label: "Browse templates",
          icon: ArrowDownIcon,
          action: () => {
            labelConfigTemplateManagementDialogOpen = true;
          },
        },
        {
          label: "Save as template",
          icon: SaveIcon,
          items: {
            save: {
              items: [
                {
                  label: "Create new template",
                  icon: FilePlusIcon,
                  action: () => {
                    labelConfigTemplateSaveModalOpen = true;
                  },
                },
              ],
            },
            replace: {
              label: "Overwrite existing",
              items: replaceItems,
            },
          },
        },
      ],
    },
  });
</script>

<Can action="update" resource="dataset:label_config_templates" scopes={["as_org_owner", "as_user"]}>
  <DropdownMenus {menus}>
    {#snippet trigger({ props })}
      <Button {...props} variant="outline" class="w-auto">
        Templates
        <ChevronsUpDownIcon />
      </Button>
    {/snippet}
  </DropdownMenus>
</Can>

<LabelConfigTemplateManagementSheet
  bind:open={labelConfigTemplateManagementDialogOpen}
  datasetModality={modality}
  {onApply}
  onMutated={updateTemplates}
/>

<LabelConfigTemplateSaveModal
  title="Template"
  action="create"
  config={getConfig()}
  {modality}
  {organizationId}
  onSaved={handleSaved}
  bind:open={labelConfigTemplateSaveModalOpen}
/>

<ConfirmModal
  title="Overwrite template"
  description={`Are you sure you want to overwrite this template "${pendingReplaceTemplate?.name}"? This action cannot be undone.`}
  confirmLabel="Yes, Overwrite"
  onCancel={() => {
    pendingReplaceTemplate = null;
  }}
  onConfirm={confirmReplaceTemplate}
  bind:open={openConfirmReplaceModal}
/>
