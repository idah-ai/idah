<script lang="ts">
  import { page } from "$app/state";
  import { getContext, onMount, tick } from "svelte";
  import {
    ArrowDownIcon,
    ChevronsUpDownIcon,
    FileIcon,
    FilePlusIcon,
    FileXIcon,
    LayersIcon,
    SaveIcon,
  } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";
  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import FeedbackConfigTemplateSaveModal from "@/components/app/datasets/feedbacks/overlays/FeedbackConfigTemplateSaveModal.svelte";
  import FeedbackTemplateManagementSheet from "@/components/app/datasets/feedbacks/overlays/FeedbackTemplateManagementSheet.svelte";

  import { ConfirmModalChoice } from "@/components/app/overlays/modals/confirm-modal.types";
  import {
    feedbackConfigTemplate,
    getFeedbackConfigController,
  } from "@/components/app/datasets/feedbacks/feedback.controller.svelte";
  import { showConfirmModal } from "@/components/app/overlays/modals/confirm-modal.service.svelte";
  import type { IDropdownMenuItem, IDropdownMenus } from "@/components/app/dropdown-menus/types";
  import type { IFeedbackConfig } from "@/plugin/v2/types";
  import type { FeedbackConfigTemplateRecord } from "@/data/model/dataset/feedback-config-templates/record";

  interface Props {
    onConfigurationSaved: (config: IFeedbackConfig) => void;
  }

  let { onConfigurationSaved }: Props = $props();

  const datasetId = page.params.datasetId as string;
  const key: symbol = getContext("key");
  const datasetFeedbackConfigController = getFeedbackConfigController(key);

  onMount(async () => {
    await tick();
    await feedbackConfigTemplate.loadTemplates();
  });

  const replaceItems = $derived<IDropdownMenuItem[]>(
    feedbackConfigTemplate.templates.length === 0
      ? [
          {
            label: "No templates to overwrite",
            disabled: true,
            icon: FileXIcon,
          },
        ]
      : feedbackConfigTemplate.templates.map((template) => ({
          label: template.name,
          icon: FileIcon,
          // Disable each replace template menu when both config are the same.
          disabled:
            JSON.stringify(template.feedback_configuration) ===
            JSON.stringify(datasetFeedbackConfigController.getConfigHash()),
          action: () => confirmReplaceTemplate(template),
        })),
  );

  const menus: IDropdownMenus = $derived({
    actions: {
      items: [
        {
          label: "Browse templates",
          icon: ArrowDownIcon,
          action: () => feedbackConfigTemplate.openSheet(),
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
                  action: () => feedbackConfigTemplate.openFormModal(),
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

  async function confirmReplaceTemplate(template: FeedbackConfigTemplateRecord) {
    const choice = await showConfirmModal({
      title: "Overwrite template",
      description: `Are you sure you want to overwrite this template "${template.name}"? This action cannot be undone.`,
      confirmLabel: "Yes, Overwrite",
    });

    if (choice === ConfirmModalChoice.Cancel) return;

    const config = datasetFeedbackConfigController.getConfigHash();

    /**
     * Actions once confirm
     * 1. Replace current config to selected template
     * 2. Update current config to current dataset
     * 3. Mark current config as saved
     */
    const [, savedConfig] = await Promise.all([
      feedbackConfigTemplate.replace({ templateId: template.id, config }),
      datasetFeedbackConfigController.updateConfiguration(datasetId),
    ]);

    if (savedConfig) {
      onConfigurationSaved(savedConfig);
    }
  }
</script>

<Can action="update" resource="dataset:feedback_config_templates" scopes={["as_org_owner", "as_user"]}>
  <DropdownMenus {menus}>
    {#snippet trigger({ props })}
      <Button {...props} variant="outline" class="w-fit">
        <LayersIcon />
        Feedback Templates
        <ChevronsUpDownIcon />
      </Button>
    {/snippet}
  </DropdownMenus>
</Can>

<FeedbackConfigTemplateSaveModal />
<FeedbackTemplateManagementSheet />
