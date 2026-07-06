<script lang="ts">
  import { onMount } from "svelte";
  import { ArrowDownIcon, ChevronsUpDownIcon, FileIcon, FilePlusIcon, SaveIcon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import SaveNewTemplateFormModal from "$lib/components/app/datasets/labels/overlays/SaveNewTemplateFormModal.svelte";
  import LabelConfigTemplateManagementSheet from "@/components/app/datasets/labels/overlays/LabelConfigTemplateManagementSheet.svelte";

  import {
    LabellingConfigurationTemplateRecord,
    labellingConfigurationTemplateDataSource,
  } from "@/data/model/dataset/labelling-configuration-template/record";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { showActionFailedToast } from "@/utils/error/error.toasts";

  import type { IDropdownMenus, IDropdownMenuItem } from "@/components/app/dropdown-menus/types";
  import type { IConfig } from "@/plugin/v2/types";

  interface Props {
    getConfig: () => IConfig;
    organizationId: number | string;
    onApply?: (config: IConfig) => void;
    onSaved?: () => void;
  }
  let { getConfig, organizationId, onApply, onSaved }: Props = $props();

  let labelConfigTemplateManagementDialogOpen = $state(false);
  let saveNewTemplateFormModalOpen = $state(false);
  let templates = $state<LabellingConfigurationTemplateRecord[]>([]);

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

  /** Refresh the dirty flag on the host + keep the Replace list up to date. */
  async function handleSaved() {
    onSaved?.();
    await loadTemplates();
  }

  async function replaceTemplate(id: string) {
    try {
      await labellingConfigurationTemplateDataSource.update(
        id,
        { attributes: { labeling_configuration: getConfig() } },
        { showErrorToast: false },
      );
      showToast.success({ title: "Template replaced", description: "The template has been updated." });
      await handleSaved();
    } catch (error) {
      showActionFailedToast(error);
    }
  }

  const replaceItems = $derived<IDropdownMenuItem[]>(
    templates.length === 0
      ? [{ label: "No templates to overwrite", disabled: true }]
      : templates.map((template) => ({
          label: template.name,
          icon: FileIcon,
          action: () => replaceTemplate(template.id),
        })),
  );

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
                    saveNewTemplateFormModalOpen = true;
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

<Can action="update" resource="dataset:labeling_configuration_templates" scopes={["as_org_owner", "as_user"]}>
  <DropdownMenus {menus}>
    {#snippet trigger({ props })}
      <Button {...props} variant="outline" class="w-auto">
        Templates
        <ChevronsUpDownIcon />
      </Button>
    {/snippet}
  </DropdownMenus>
</Can>

<LabelConfigTemplateManagementSheet bind:open={labelConfigTemplateManagementDialogOpen} {onApply} />

<SaveNewTemplateFormModal
  title="Template"
  action="create"
  config={getConfig()}
  {organizationId}
  onSaved={handleSaved}
  bind:open={saveNewTemplateFormModalOpen}
/>
