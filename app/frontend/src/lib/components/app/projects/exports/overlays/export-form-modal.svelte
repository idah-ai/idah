<script lang="ts">
  import { page } from "$app/state";
  import { CheckIcon } from "@lucide/svelte";

  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { CommandItem } from "@/components/ui/command";
  import { DialogTitle } from "@/components/ui/dialog";

  import { exportingExportRecords } from "@/components/app/sync/exports/store";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { ExportRecord, ExportsBackendDataSource } from "@/data/model/sync/exports/record";
  import { cn } from "@/utils";
  import { showActionFailedToast } from "@/utils/error/error.toasts";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
  import { ScrollArea } from "@/components/ui/scroll-area";
  import type { LabelValue } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    datasetRecords: Array<DatasetRecord>;
  }
  let { action, open = $bindable(), title, datasetRecords }: Props = $props();

  // Variables
  const resource = ExportRecord.type;

  let projectId = page.params.projectId as string;
  let exporter = $state<string>("");
  let exporting = $state<boolean>(false);

  // Functions
  function resetForm(): void {
    exporter = "";
  }

  async function loadExportFormatChoices(): Promise<Array<LabelValue<string | number>>> {
    if (!datasetRecords) return [];

    const modalities = Array.from(new Set(datasetRecords.map((record) => record.modality)));
    const exportFormats = await ExportsBackendDataSource.formats({ modalities });

    return exportFormats.map((format) => ({
      label: format.name,
      description: format.description,
      value: format.exporter,
    }));
  }

  async function exportDataset() {
    exporting = true;
    try {
      if (!datasetRecords) return;

      const createdExportRecordRes = await ExportsBackendDataSource.export({
        projectId,
        datasetIds: datasetRecords.map((record) => record.id),
        exporter,
      });

      open = false;
      $exportingExportRecords = [createdExportRecordRes.data];
      showToast.success({
        title: "Dataset exported",
        description: "The dataset(s) export is in progress.",
      });
    } catch (error) {
      showActionFailedToast(error);
      exporting = false;
    }
  }
</script>

<FormModal
  {action}
  {title}
  description="Please select an export format for the selected datasets."
  loading={exporting}
  onCancel={resetForm}
  onConfirm={exportDataset}
  bind:open
>
  {#snippet modalTitle()}
    <DialogTitle>{title}</DialogTitle>
  {/snippet}

  <div class="flex flex-col gap-4">
    <!-- SELECT FIELD TO SELECT FORMAT -->
    {#await loadExportFormatChoices() then choices}
      <SingleSelectField
        name="{resource}/exporter"
        label="Format"
        placeholder="Select an export format"
        required
        {choices}
        value={exporter}
        onSelected={(selectedValue) => {
          exporter = selectedValue as string;
        }}
      >
        {#snippet slotChoice({ choice, select })}
          {@const { label, description, value } = choice}
          <CommandItem value={String(value)} onSelect={() => select(choice)}>
            <CheckIcon
              class={cn("mr-2 size-4", {
                "opacity-0": value !== exporter,
              })}
            />
            <div class="flex flex-col gap-0">
              <p>{label}</p>
              <small class="text-muted-foreground">{description}</small>
            </div>
          </CommandItem>
        {/snippet}
      </SingleSelectField>
    {/await}

    <ScrollArea class="h-40">
      {#each datasetRecords as datasetRecord (datasetRecord.id)}
        <Item class="py-2">
          <ItemContent>
            <ItemTitle>{datasetRecord.name}</ItemTitle>
          </ItemContent>
        </Item>
      {/each}
    </ScrollArea>
  </div>

  {#snippet confirm()}
    <Button disabled={!exporter} loading={exporting} onclick={exportDataset}>Export</Button>
  {/snippet}
</FormModal>
