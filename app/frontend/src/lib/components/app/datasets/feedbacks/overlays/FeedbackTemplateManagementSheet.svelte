<script lang="ts">
  import { tick } from "svelte";
  import { GalleryVerticalEndIcon, ServerCrashIcon } from "@lucide/svelte";

  import * as Sheet from "@/components/ui/sheet/index";
  import FeedbackConfigTemplateManagementList from "@/components/app/datasets/feedbacks/overlays/_FeedbackConfigTemplateManagementList.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";

  import { feedbackConfigTemplate } from "@/components/app/datasets/feedbacks/feedback.controller.svelte";
  import { feedbackConfigTemplateDataSource } from "@/data/model/dataset/feedback-config-templates/record";
  import type { Resource } from "@/security/types";

  const resource: Resource = "dataset:feedback_config_templates";

  async function refreshSheetData() {
    await tick();
    await feedbackConfigTemplate.loadTemplates();
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
      placeholder="Select template"
      valueKey="id"
      dataSource={feedbackConfigTemplateDataSource}
      listOptions={{
        sort: ["name", "created_at"],
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

    {#key feedbackConfigTemplate.selection}
      {#await refreshSheetData() then _}
        {#if feedbackConfigTemplate.isLoading}
          <div class="flex min-h-screen items-center justify-center">
            <Spinner size="lg" />
          </div>
        {:else if feedbackConfigTemplate.template.isEmpty}
          <ResponseBlock
            icon={GalleryVerticalEndIcon}
            title="No Templates Yet"
            description="You havn't created any feedback templates. Build a feedback configuration, then use 'Save as a template to reuse it across datasets.'"
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
  </Sheet.Content>
</Sheet.Root>
