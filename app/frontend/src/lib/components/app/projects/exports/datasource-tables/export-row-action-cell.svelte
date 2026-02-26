<script lang="ts">
  import { page } from "$app/state";
  import { DownloadIcon } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import { writable } from "svelte/store";

  import Button from "@/components/ui/button/button.svelte";
  import { Spinner } from "@/components/ui/spinner";

  import { ExportRecord, exportsBasePath } from "@/data/model/sync/exports/record";
  import { SyncJobRecord, SyncJobsBackendDataSource } from "@/data/model/sync/jobs/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: exportRecord }: DataTableCellBaseProps<ExportRecord> = $props();

  // Variables
  const processingStatuses = ["running", "pending"];

  let projectId = page.params.projectId as string;
  let progressInterval = writable<number | undefined>(undefined); // Note: Need to use writable because it's not reactive
  let status = $derived((exportRecord.job as unknown as SyncJobRecord).status);
  let exports = $state(exportRecord.exports);

  // Lifecycles
  $effect(() => {
    periodicCheckJobStatus();

    return () => stopPeriodicCheckJobStatus();
  });

  // Functions
  /**
   * Fetch jobs data every 10 seconds, to keep the status updated
   * Note: Only fetch if the syncJob is in a processing state
   */
  async function periodicCheckJobStatus() {
    if (processingStatuses.includes(status)) {
      $progressInterval = setInterval(async () => {
        try {
          if (!processingStatuses.includes(status)) {
            stopPeriodicCheckJobStatus();
            return;
          }

          const jobRes = await SyncJobsBackendDataSource.get(exportRecord.id, {
            included: ["exports"],
            fields: {
              [SyncJobRecord.type]: ["status", "exports.id"],
            },
            noCache: true,
          });

          status = jobRes.data.status;
          exports = jobRes.data.exports;
        } catch (error) {
          console.error("Error fetching updated export:", error);
          stopPeriodicCheckJobStatus();
        }
      }, 2_000);
    } else {
      //
    }
  }

  // Clean up blob URL and animation when component is destroyed
  function stopPeriodicCheckJobStatus() {
    clearInterval($progressInterval);
  }

  function cleanup() {
    stopPeriodicCheckJobStatus();
  }

  onDestroy(cleanup);

  function openFileLink(exportId: string) {
    window.open(`${exportsBasePath}/${exportId}/download`, "_blank");
  }
</script>

<!-- <div>
  
</div> -->
<div class="flex w-full justify-end pr-2">
  {#key status}
    {#if processingStatuses.includes(status)}
      <Spinner size="sm" />
    {:else}
      {#each exports as xport (xport.id)}
        <Button variant="ghost" size="icon-sm" onclick={() => openFileLink(xport.id)}>
          <DownloadIcon />
        </Button>
      {/each}
    {/if}
  {/key}
</div>
