<script lang="ts">
  import { getContext, tick } from "svelte";
  import { GalleryVerticalEndIcon, ServerCrashIcon } from "@lucide/svelte";

  import * as Sheet from "@/components/ui/sheet/index";
  import FeedbackConfigTemplateManagementList from "@/components/app/datasets/feedbacks/overlays/_FeedbackConfigTemplateManagementList.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";

  import { feedbackConfigTemplate } from "@/components/app/datasets/feedbacks/feedback.controller.svelte";
  import { feedbackConfigTemplateDataSource } from "@/data/model/dataset/feedback-config-templates/record";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import type { Resource } from "@/security/types";

  const resource: Resource = "dataset:feedback_config_templates";
  const dataset: DatasetRecord = getContext("dataset");

  async function refreshSheetData() {
    await tick();
    await feedbackConfigTemplate.loadTemplates(dataset.modality);
  }
</script>

{#snippet SingleSelectTemplateField()}
  {#key feedbackConfigTemplate.selection}
    <SingleSelectDatasourceField
      name="{resource}.id"
      class="max-w-64"
      displayKey="name"
      searchable
      searchKeyWithOperation="name__match"
      placeholder="Select feedback template"
      searchPlaceholder="Search a template"
      valueKey="id"
      dataSource={feedbackConfigTemplateDataSource}
      listOptions={{
        sort: ["name", "created_at"],
        filters: { modality: dataset.modality },
      }}
      value={feedbackConfigTemplate.selection?.id || null}
      onSelected={(selectedId: string | number | null) => feedbackConfigTemplate.selectTemplate(selectedId)}
    />
  {/key}
{/snippet}

<Sheet.Root bind:open={feedbackConfigTemplate.sheetOpen}>
  <Sheet.Content class="max-w-[85vw] min-w-[85vw]">
    <Sheet.Header class="flex-row items-center gap-4">
      {@render SingleSelectTemplateField()}
    </Sheet.Header>

    <div class="min-h-0 flex-1 overflow-y-auto">
      {#key feedbackConfigTemplate.selection}
        {#await refreshSheetData() then _}
          {#if feedbackConfigTemplate.isLoading}
            <div class="flex h-full items-center justify-center">
              <Spinner size="lg" />
            </div>
          {:else if feedbackConfigTemplate.template.isEmpty}
            <ResponseBlock
              icon={GalleryVerticalEndIcon}
              title="No Templates Yet"
              description="You haven't created any feedback templates. Build a feedback configuration, then use 'Save as template' to reuse it across datasets."
            >
              {#snippet actions()}
                {#if feedbackConfigTemplate.template.isNotEmpty}
                  {#key feedbackConfigTemplate.selection}
                    {@render SingleSelectTemplateField()}
                  {/key}
                {/if}
              {/snippet}
            </ResponseBlock>
          {:else if feedbackConfigTemplate.template.isNotEmpty && feedbackConfigTemplate.isNotSelected}
            <ResponseBlock
              icon={GalleryVerticalEndIcon}
              title="No Templates Selected"
              description="Select a feedback template to view, edit or apply it."
            >
              {#snippet actions()}
                {#key feedbackConfigTemplate.selection}
                  {@render SingleSelectTemplateField()}
                {/key}
              {/snippet}
            </ResponseBlock>
          {:else if feedbackConfigTemplate.selection}
            <FeedbackConfigTemplateManagementList
              feedbackConfig={feedbackConfigTemplate.selection.feedback_configuration}
            />
          {/if}
        {:catch}
          <ResponseBlock
            icon={ServerCrashIcon}
            title="Something went wrong"
            description="There was an error with our server. Please try again."
          ></ResponseBlock>
        {/await}
      {/key}
    </div>
  </Sheet.Content>
</Sheet.Root>
