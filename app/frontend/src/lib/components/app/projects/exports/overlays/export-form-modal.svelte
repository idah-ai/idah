<script lang="ts">
  import { page } from "$app/state";
  import { CheckIcon } from "@lucide/svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import NumberField from "@/components/app/forms/fields/input/number-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { CommandItem } from "@/components/ui/command";
  import { DialogTitle } from "@/components/ui/dialog";
  import { Item, ItemContent, ItemDescription } from "@/components/ui/item";
  import Label from "@/components/ui/label/label.svelte";
  import { ScrollArea } from "@/components/ui/scroll-area";
  import { Skeleton } from "@/components/ui/skeleton";
  import Switch from "@/components/ui/switch/switch.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { exportingExportRecords } from "@/components/app/sync/exports/store";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { includeMedias } from "@/data/model/sync/exports/constant";
  import {
    defaultExportOptionValues,
    exportOptionChoices,
    exportOptionKind,
    exportOptionLabel,
    exportOptionPayload,
  } from "@/data/model/sync/exports/options";
  import { ExportRecord, ExportsBackendDataSource } from "@/data/model/sync/exports/record";
  import { cn } from "@/utils";
  import { showActionFailedToast } from "@/utils/error/error.toasts";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { ExportFormat, ExportOptionValues } from "@/data/model/sync/exports/type";
  import type { LabelValue } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    datasetRecords: Array<DatasetRecord>;
  }
  let { action, open = $bindable(), title, datasetRecords }: Props = $props();

  // Variables
  const resource = ExportRecord.type;

  let projectId = page.params.projectId as string;
  let exporting = $state<boolean>(false);
  let selectedExporter = $state<string>("");
  let selectedIncludeMedias = $state<string>("original");
  let completedEntriesOnly = $state<boolean>(true);

  // The selected format's own options, declared by its exporter
  let exportFormats = $state<Array<ExportFormat>>([]);
  let optionValues = $state<ExportOptionValues>({});
  let optionFields = $derived(exportFormats.find((format) => format.exporter === selectedExporter)?.options ?? []);

  // Functions
  function resetForm(): void {
    selectedExporter = "";
    selectedIncludeMedias = "original";
    completedEntriesOnly = true;
    optionValues = {};
  }

  function selectExporter(exporter: string): void {
    selectedExporter = exporter;
    const format = exportFormats.find((item) => item.exporter === exporter);
    optionValues = defaultExportOptionValues(format?.options);
  }

  async function loadExportFormatChoices(): Promise<Array<LabelValue<string | number>>> {
    if (!datasetRecords) return [];

    const modalities = Array.from(new Set(datasetRecords.map((record) => record.modality)));
    exportFormats = await ExportsBackendDataSource.formats({ modalities });

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
        exporter: selectedExporter,
        includeMedias: selectedIncludeMedias,
        completedEntries: completedEntriesOnly,
        options: exportOptionPayload(optionFields, optionValues),
      });

      $exportingExportRecords = [createdExportRecordRes.data];
      open = false;
      exporting = false;
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
  onConfirm={() => {}}
  bind:open
>
  {#snippet modalTitle()}
    <DialogTitle>{title}</DialogTitle>
  {/snippet}

  <div class="flex flex-col gap-4 pl-1">
    <!-- SELECT FIELD TO SELECT FORMAT -->
    {#await loadExportFormatChoices()}
      <Skeleton class="h-9 w-full" />
    {:then choices}
      <SingleSelectField
        name="{resource}/exporter"
        label="Format"
        placeholder="Select an export format"
        required
        {choices}
        value={selectedExporter}
        onSelected={(selectedValue) => {
          selectExporter(selectedValue as string);
        }}
      >
        {#snippet slotChoice({ choice, select })}
          {@const { label, description, value } = choice}
          <CommandItem value={String(value)} onSelect={() => select(choice)}>
            <CheckIcon
              class={cn("mr-2 size-4", {
                "opacity-0": value !== selectedExporter,
              })}
            />
            <div class="flex flex-col gap-0">
              <p>{label}</p>
              <small class="max-w-xs whitespace-normal text-muted-foreground">{description}</small>
            </div>
          </CommandItem>
        {/snippet}
      </SingleSelectField>
    {/await}

    <!-- THE SELECTED FORMAT'S OWN OPTIONS -->
    {#each optionFields as field (field.name)}
      {@const kind = exportOptionKind(field)}
      {@const name = `${resource}/options/${field.name}`}
      {#if kind === "select"}
        <SingleSelectField
          {name}
          label={exportOptionLabel(field)}
          info={field.description}
          required={field.required}
          choices={exportOptionChoices(field)}
          value={optionValues[field.name] as string | null}
          onSelected={(selectedValue) => {
            optionValues[field.name] = selectedValue;
          }}
        >
          {#snippet slotChoice({ choice, select })}
            {@const { label, description, value } = choice}
            <CommandItem value={String(value)} onSelect={() => select(choice)}>
              <CheckIcon
                class={cn("mr-2 size-4 shrink-0", {
                  "opacity-0": value !== optionValues[field.name],
                })}
              />
              <div class="flex flex-col gap-0">
                <p>{label}</p>
                {#if description}
                  <small class="max-w-xs whitespace-normal text-muted-foreground">{description}</small>
                {/if}
              </div>
            </CommandItem>
          {/snippet}
        </SingleSelectField>
      {:else if kind === "switch"}
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <Switch
              id={name}
              checked={optionValues[field.name] === true}
              onCheckedChange={(checkedValue) => {
                optionValues[field.name] = checkedValue;
              }}
            />
            <Label for={name}>{exportOptionLabel(field)}</Label>
          </div>
          {#if field.description}
            <small class="text-muted-foreground">{field.description}</small>
          {/if}
        </div>
      {:else if kind === "number"}
        <NumberField
          {name}
          label={exportOptionLabel(field)}
          description={field.description}
          required={field.required}
          min={field.min}
          max={field.max}
          step={field.type === "integer" ? 1 : 0.01}
          bind:value={() => optionValues[field.name] as number | null, (value) => (optionValues[field.name] = value)}
        />
      {:else}
        <InputField
          {name}
          label={exportOptionLabel(field)}
          description={field.description}
          required={field.required}
          bind:value={() => optionValues[field.name] as string | null, (value) => (optionValues[field.name] = value)}
        />
      {/if}
    {/each}

    <SingleSelectField
      name="{resource}/include_medias"
      label="Include medias"
      placeholder="Select an media to include"
      required
      choices={includeMedias}
      value={selectedIncludeMedias}
      onSelected={(selectedValue) => {
        selectedIncludeMedias = selectedValue as string;
      }}
    >
      {#snippet slotChoice({ choice, select })}
        {@const { label, description, value } = choice}
        <CommandItem value={String(value)} onSelect={() => select(choice)}>
          <CheckIcon
            class={cn("mr-2 size-4", {
              "opacity-0": value !== selectedIncludeMedias,
            })}
          />
          <div class="flex flex-col gap-0">
            <p>{label}</p>
            <small class="max-w-xs whitespace-normal text-muted-foreground">{description}</small>
          </div>
        </CommandItem>
      {/snippet}
    </SingleSelectField>

    <!-- SWITCH TO EXPORT ONLY THE COMPLETED ENTRIES -->
    <div class="flex items-center gap-2">
      <Switch
        id="export-completed-entries"
        checked={completedEntriesOnly}
        onCheckedChange={(checkedValue) => {
          completedEntriesOnly = checkedValue;
        }}
      />
      <Label for="export-completed-entries">Completed Entries Only</Label>
    </div>

    <div class="flex flex-col gap-1">
      <Text size="sm" weight="medium">Dataset(s)</Text>
      <ScrollArea class="h-40">
        {#each datasetRecords as datasetRecord (datasetRecord.id)}
          <Item class="py-1.5">
            <ItemContent>
              <ItemDescription>{datasetRecord.name}</ItemDescription>
            </ItemContent>
          </Item>
        {/each}
      </ScrollArea>
    </div>
  </div>

  {#snippet confirm()}
    <Button disabled={!selectedExporter} loading={exporting} onclick={exportDataset}>Export</Button>
  {/snippet}
</FormModal>
