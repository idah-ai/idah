<script lang="ts">
  import { getContext } from "svelte";
  import { page } from "$app/state";
  import { CheckIcon } from "@lucide/svelte";

  import EntryStatus from "@/components/app/datasets/entries/badges/entry-status.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import NumberField from "@/components/app/forms/fields/input/number-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import SwitchField from "@/components/app/forms/fields/input/switch-field.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { CommandItem } from "@/components/ui/command";
  import { DialogTitle } from "@/components/ui/dialog";
  import { Item, ItemContent } from "@/components/ui/item";
  import { ScrollArea } from "@/components/ui/scroll-area";
  import { Skeleton } from "@/components/ui/skeleton";
  import Text from "@/components/ui/text/Text.svelte";

  import { exportingExportRecords } from "@/components/app/sync/exports/store";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { EntryRecord, entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { includeMedias } from "@/data/model/sync/exports/constant";
  import {
    defaultExportOptionValues,
    exportOptionChoices,
    exportOptionKind,
    exportOptionLabel,
    exportOptionPayload,
  } from "@/data/model/sync/exports/options";
  import { ExportRecord, ExportsBackendDataSource } from "@/data/model/sync/exports/record";
  import { SyncJobRecord } from "@/data/model/sync/jobs/record";
  import { cn } from "@/utils";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { pluralizeUnit } from "@/utils/unit";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { ExportFormat, ExportOptionValues } from "@/data/model/sync/exports/type";

  import type { LabelValue } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    /** All selected entry ids (the authoritative scope — spans the whole dataset, not just the current page). */
    entryIds: string[];
    /** Records already loaded on the current page — used for name/status display without refetching. */
    entries?: Array<EntryRecord>;
  }
  let { action, open = $bindable(), title = "Export Entries", entryIds, entries = [] }: Props = $props();

  // Variables
  const resource = ExportRecord.type;
  const dataset: DatasetRecord = getContext("dataset");

  let projectId = page.params.projectId as string;
  let exporting = $state<boolean>(false);
  let selectedExporter = $state<string>("");
  let selectedIncludeMedias = $state<string>("original");
  let completedEntriesOnly = $state<boolean>(false);
  let selectedEntryCount = $derived(entryIds.length);

  // Entries selected on other pages aren't on the current page, so fetch their
  // records by id to still show name/status. The export always sends the full
  // `entryIds` selection.
  let fetchedIds = $state<Set<string>>(new Set());
  let fetchedRecords = $state<Array<EntryRecord>>([]);

  let knownById = $derived(
    new Map<string, EntryRecord>([...entries, ...fetchedRecords].map((entry) => [entry.id, entry])),
  );

  $effect(() => {
    const missing = entryIds.filter((id) => !knownById.has(id) && !fetchedIds.has(id));
    if (missing.length === 0) return;

    fetchedIds = new Set([...fetchedIds, ...missing]);
    void entriesBackendDataSource
      .list({
        fields: { [EntryRecord.type]: ["id", "name", "status", "wf_step", "priority"] },
        filters: { id: missing },
        noCache: true,
      })
      .then((res) => {
        fetchedRecords = [...fetchedRecords, ...res.data];
      })
      .catch((error) => {
        console.error("Failed to load selected entries:", error);
      });
  });

  // The selected format's own options, declared by its exporter
  let exportFormats = $state<Array<ExportFormat>>([]);
  let optionValues = $state<ExportOptionValues>({});
  let optionFields = $derived(exportFormats.find((format) => format.exporter === selectedExporter)?.options ?? []);

  // Functions
  function resetForm(): void {
    selectedExporter = "";
    selectedIncludeMedias = "original";
    completedEntriesOnly = false;
    optionValues = {};
  }

  function selectExporter(exporter: string): void {
    selectedExporter = exporter;
    const format = exportFormats.find((item) => item.exporter === exporter);
    optionValues = defaultExportOptionValues(format?.options);
  }

  async function loadExportFormatChoices(): Promise<Array<LabelValue<string | number>>> {
    if (!dataset) return [];

    exportFormats = await ExportsBackendDataSource.formats({ modalities: [dataset.modality] });

    return exportFormats.map((format) => ({
      label: format.name,
      description: format.description,
      value: format.exporter,
    }));
  }

  async function exportEntries() {
    exporting = true;
    try {
      if (!dataset || entryIds.length === 0) return;

      const createdExportRecordRes = await ExportsBackendDataSource.export({
        projectId,
        datasetIds: [dataset.id],
        entryIds,
        exporter: selectedExporter,
        includeMedias: selectedIncludeMedias,
        completedEntries: completedEntriesOnly,
        options: exportOptionPayload(optionFields, optionValues),
      });

      // The create response has no job — refetch with it included so the
      // floating card can classify entry vs dataset export immediately.
      const exportRecordRes = await ExportsBackendDataSource.get(createdExportRecordRes.data.id, {
        included: ["job"],
        fields: {
          [SyncJobRecord.type]: ["id", "arguments"],
          [ExportRecord.type]: ["id", "job_id"],
        },
        noCache: true,
      });

      $exportingExportRecords = [exportRecordRes.data];
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
  description={`Please select an export format for ${pluralizeUnit(selectedEntryCount, "the selected entry", "the selected entries")}.`}
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
              <small class="text-muted-foreground max-w-xs whitespace-normal">{description}</small>
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
          value={optionValues[field.name] as string | number | null}
          onSelected={(selectedValue) => {
            optionValues[field.name] = selectedValue as string | number;
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
                  <small class="text-muted-foreground max-w-xs whitespace-normal">{description}</small>
                {/if}
              </div>
            </CommandItem>
          {/snippet}
        </SingleSelectField>
      {:else if kind === "switch"}
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <SwitchField
              {name}
              label={exportOptionLabel(field)}
              info={field.description}
              bordered
              bind:checked={optionValues[field.name] as boolean}
            />
          </div>
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
            <small class="text-muted-foreground max-w-xs whitespace-normal">{description}</small>
          </div>
        </CommandItem>
      {/snippet}
    </SingleSelectField>

    <div class="flex flex-col gap-1">
      <Text size="sm" weight="medium">
        {pluralizeUnit(
          selectedEntryCount,
          `Selected entry (${selectedEntryCount})`,
          `Selected entries (${selectedEntryCount})`,
        )}
      </Text>
      <ScrollArea class="h-40">
        {#each entryIds as id (id)}
          {@const entry = knownById.get(id)}
          <Item class="py-1.5">
            <ItemContent>
              <div class="flex items-center justify-between gap-2">
                <span class="truncate">{entry?.name || id}</span>
                {#if entry}
                  <EntryStatus {entry} />
                {/if}
              </div>
            </ItemContent>
          </Item>
        {/each}
      </ScrollArea>
    </div>
  </div>

  {#snippet confirm()}
    <Button disabled={!selectedExporter} loading={exporting} onclick={exportEntries}>Export</Button>
  {/snippet}
</FormModal>
