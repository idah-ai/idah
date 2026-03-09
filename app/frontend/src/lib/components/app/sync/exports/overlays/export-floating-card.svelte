<script lang="ts">
  import { ChevronsDownUpIcon, ChevronsUpDownIcon, CircleCheckBigIcon, DownloadIcon, XIcon } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import { writable } from "svelte/store";

  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Badge from "@/components/ui/badge/badge.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
  import { Item, ItemActions, ItemContent, ItemTitle } from "@/components/ui/item";
  import Spinner from "@/components/ui/spinner/spinner.svelte";

  import { exportingExportRecords } from "@/components/app/sync/exports/store";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { ExportRecord, ExportsBackendDataSource, exportsBasePath } from "@/data/model/sync/exports/record";
  import { SyncJobRecord, SyncJobsBackendDataSource } from "@/data/model/sync/jobs/record";
  import { cn } from "@/utils";
  import { truncate } from "@/utils/string";

  // Variables
  let showFloatingCard = $derived<boolean>($exportingExportRecords.length > 0);
  let open = $state<boolean>(false);
  let progressInterval = writable<number | undefined>(undefined); // Note: Need to use writable because it's not reactive
  let isDownloadReady = $state<boolean>(false);
  let isDownloadError = $derived<boolean>(
    $exportingExportRecords.filter(
      (exportRecord) => (exportRecord.job as unknown as SyncJobRecord).status === "errored",
    ).length > 0,
  );

  // Functions
  function hideFloatingCard(): void {
    $exportingExportRecords = [];
  }

  async function getExportDatasetsName(jobId: string): Promise<Array<string>> {
    const jobRes = await SyncJobsBackendDataSource.get(jobId, {
      fields: {
        [SyncJobRecord.type]: ["id", "arguments"],
      },
    });
    const datasetIds = jobRes.data.arguments.dataset_ids;

    const datasetsRes = await datasetsBackendDataSource.list({
      fields: {
        [DatasetRecord.type]: ["id", "name"],
      },
      filters: {
        id: datasetIds,
      },
    });

    return datasetsRes.data.map((dataset) => dataset.name);
  }

  async function periodicCheckSyncJobStatus(records: Array<ExportRecord>) {
    isDownloadReady = false;

    $progressInterval = setInterval(async () => {
      try {
        const filenames = records.map((exportingExportRecord) => exportingExportRecord.filename);

        if (!filenames.includes(null)) {
          stopPeriodicCheckSyncJobStatus();
          isDownloadReady = true;
          return;
        }

        await Promise.all(
          records.map(async (exportingExportRecord, index) => {
            const exportRes = await ExportsBackendDataSource.get(exportingExportRecord.id, {
              included: ["job"],
              fields: {
                [SyncJobRecord.type]: ["id", "status", "progress"],
                [ExportRecord.type]: ["id", "job_id", "filename"],
              },
              noCache: true,
            });

            $exportingExportRecords[index] = exportRes.data;
          }),
        );

        /** If there are error status on Job, stop periodic check */
        if (isDownloadError) {
          stopPeriodicCheckSyncJobStatus();
        }
      } catch (error) {
        console.error("Error fetching updated export:", error);
        stopPeriodicCheckSyncJobStatus();
      }
    }, 1_000);
  }

  function stopPeriodicCheckSyncJobStatus() {
    clearInterval($progressInterval);
  }

  function cleanup() {
    stopPeriodicCheckSyncJobStatus();
  }

  function openFileLink(exportId: string) {
    window.open(`${exportsBasePath}/${exportId}/download`, "_blank");
  }

  // Lifecycles
  $effect(() => {
    periodicCheckSyncJobStatus($exportingExportRecords);

    return () => stopPeriodicCheckSyncJobStatus();
  });

  onDestroy(cleanup);
</script>

{#if showFloatingCard}
  <div class="bg-background fixed right-2 bottom-0 z-50 h-auto rounded-md rounded-br-none rounded-bl-none border">
    <Collapsible bind:open>
      <CollapsibleTrigger>
        <Button
          variant="ghost"
          size="lg"
          class={cn("w-96 justify-start rounded-br-none rounded-bl-none", {
            "bg-emerald-100 text-emerald-600 hover:bg-emerald-200 hover:text-emerald-700 dark:bg-emerald-900 dark:text-emerald-100 dark:hover:bg-emerald-800 dark:hover:text-emerald-200":
              isDownloadReady,
            "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary dark:bg-primary/10 dark:text-primary dark:hover:bg-primary/20 dark:hover:text-primary":
              !isDownloadReady,
            "bg-destructive text-primary-foreground hover:bg-destructive hover:text-primary-foreground":
              isDownloadError,
          })}
        >
          {#if isDownloadReady}
            <CircleCheckBigIcon />
          {:else if isDownloadError}
            <CircleAlertIcon />
          {:else}
            <Spinner size="sm" />
          {/if}
          {isDownloadReady ? "Dataset export ready" : "Dataset export in progress..."}

          <div class="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onclick={hideFloatingCard}>
              <XIcon />
            </Button>

            {#if open}
              <ChevronsDownUpIcon />
            {:else}
              <ChevronsUpDownIcon />
            {/if}
          </div>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div class="min-w-96 border-t">
          {#each $exportingExportRecords as exportingExportRecord (exportingExportRecord.id)}
            {@const { id, job_id, job, filename } = exportingExportRecord}
            {#await getExportDatasetsName(job_id) then datasetsName}
              <Item>
                <ItemContent>
                  <Tooltips>
                    {#snippet trigger()}
                      <ItemTitle>{truncate(datasetsName.join(", "), 40)}</ItemTitle>
                    {/snippet}

                    {#snippet content()}
                      {datasetsName.join(", ")}
                    {/snippet}
                  </Tooltips>
                </ItemContent>

                <ItemActions>
                  {#if filename}
                    <Button variant="ghost" size="icon-sm" onclick={() => openFileLink(id)}>
                      <DownloadIcon />
                    </Button>
                  {:else if (job as unknown as SyncJobRecord).status === "errored"}
                    <Badge variant="destructive" rounded="full">Error</Badge>
                  {:else}
                    <Spinner size="sm" />
                  {/if}
                </ItemActions>
              </Item>
            {/await}
          {/each}
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
{/if}
