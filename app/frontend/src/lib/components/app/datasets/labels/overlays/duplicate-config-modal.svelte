<script lang="ts">
  import { page } from "$app/state";
  import { toast } from "svelte-sonner";

  import MultipleSelectDatasourceField from "@/components/app/forms/fields/select/multiple/multiple-select-datasource-field.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";

  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { IConfig } from "@/plugin/interface/Activity";
  import type { Resource } from "@/security/types";

  // Props
  interface Props extends FormModalBaseProps {
    labelConfig: IConfig;
  }
  let { action, open = $bindable(), title, labelConfig }: Props = $props();

  // Variables
  const resource: Resource = "dataset:datasets";
  const maxShownSelection: number = 2;

  let projectId = $derived(page.params.projectId as string);
  let submitting = $state(false);
  let selectedDatasets = $state<Array<string>>([]);

  // Functions
  function closeThisModal(): void {
    open = false;
  }

  function resetForm(): void {
    selectedDatasets = [];
  }

  async function submit() {
    submitting = true;

    try {
      selectedDatasets.forEach(async (datasetId) => {
        await datasetsBackendDataSource.update(datasetId, {
          attributes: {
            labeling_configuration: labelConfig,
          },
        });
      });

      closeThisModal();
      toast.success("Label configuration duplicated successfully");
    } catch (error) {
      console.error(error);
      submitting = false;
    }
  }
</script>

<FormModal
  {action}
  {title}
  description="This will override the existing label configurations in selected datasets"
  loading={submitting}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  {#snippet modalTitle()}
    <DialogTitle>Duplicate this label configuations to</DialogTitle>
  {/snippet}

  <MultipleSelectDatasourceField
    name="{resource}/label_configuration"
    values={selectedDatasets}
    dataSource={datasetsBackendDataSource}
    listOptions={{
      filters: {
        project_id: projectId,
      },
      sort: ["name"],
    }}
    placeholder="Select datasets"
    searchable
    searchKeyWithOperation="name__match"
    searchPlaceholder="Search datasets by name"
    displayKey="name"
    clearable
    onSelected={(selectedChoice) => {
      selectedDatasets = selectedChoice.map((choice) => String(choice.value));
    }}
  >
    {#snippet slotTriggerValues({ selectedChoices })}
      <div class="flex flex-wrap items-center gap-1">
        {#each selectedChoices.slice(0, maxShownSelection) as selectedChoice (selectedChoice.value)}
          <Badge variant="outline" rounded="full">
            {selectedChoice.label}
          </Badge>
        {/each}

        {#if selectedChoices.slice(maxShownSelection).length > 0}
          <Badge variant="outline" rounded="full">
            +{selectedChoices.slice(maxShownSelection).length} more
          </Badge>
        {/if}
      </div>
    {/snippet}
  </MultipleSelectDatasourceField>

  {#snippet confirm()}
    <Button loading={submitting} onclick={submit}>Duplicate</Button>
  {/snippet}
</FormModal>
