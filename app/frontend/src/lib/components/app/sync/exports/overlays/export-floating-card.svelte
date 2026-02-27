<script lang="ts">
  import { ChevronsDownUpIcon, ChevronsUpDownIcon, DownloadIcon, XIcon } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import { writable } from "svelte/store";

  import Button from "@/components/ui/button/button.svelte";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
  import { Item, ItemActions, ItemContent, ItemTitle } from "@/components/ui/item";
  import Spinner from "@/components/ui/spinner/spinner.svelte";

  import { exportingExportRecords } from "@/components/app/sync/exports/store";
  import { ExportRecord, ExportsBackendDataSource, exportsBasePath } from "@/data/model/sync/exports/record";
  import { cn } from "@/utils";

  // Variables
  let showFloatingCard = $derived<boolean>($exportingExportRecords.length > 0);
  let open = $state<boolean>(false);
  let title = $derived<string>("Preparing export");
  let progressInterval = writable<number | undefined>(undefined); // Note: Need to use writable because it's not reactive

  // Functions
  function hideFloatingCard(): void {
    $exportingExportRecords = [];
  }

  async function periodicCheckSyncJobStatus(records: Array<ExportRecord>) {
    $progressInterval = setInterval(async () => {
      try {
        const filenames = records.map((exportingExportRecord) => exportingExportRecord.filename);

        if (!filenames.includes(null)) {
          stopPeriodicCheckSyncJobStatus();
          title = "Download ready";
          return;
        }

        await Promise.all(
          records.map(async (exportingExportRecord, index) => {
            const exportRes = await ExportsBackendDataSource.get(exportingExportRecord.id, {
              included: ["job"],
              fields: {
                [ExportRecord.type]: ["id", "job_id", "filename"],
              },
              noCache: true,
            });

            $exportingExportRecords[index] = exportRes.data;
          }),
        );
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
  <div class="bg-background fixed right-2 bottom-2 z-50 h-auto rounded-md border">
    <Collapsible bind:open>
      <CollapsibleTrigger>
        <Button
          variant="ghost"
          class={cn("w-96 justify-start", {
            "rounded-br-none rounded-bl-none": open,
          })}
        >
          {title}

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
            {@const { id, job_id, filename } = exportingExportRecord}
            <Item>
              <ItemContent>
                <ItemTitle>{filename || job_id}</ItemTitle>
              </ItemContent>

              <ItemActions>
                {#if filename}
                  <Button variant="ghost" size="icon-sm" onclick={() => openFileLink(id)}>
                    <DownloadIcon />
                  </Button>
                {:else}
                  <Spinner size="sm" />
                {/if}
              </ItemActions>
            </Item>
          {/each}
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
{/if}
