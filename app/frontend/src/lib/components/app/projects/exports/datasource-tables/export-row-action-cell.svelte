<script lang="ts">
  import { page } from "$app/state";
  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import Link from "@/components/ui/text/Link.svelte";
  import { export_download_path, ExportRecord } from "@/data/model/sync/exports/record";
  import { SyncJobRecord, SyncJobsBackendDataSource } from "@/data/model/sync/jobs/record";
  import { onDestroy } from "svelte";
  import { writable } from "svelte/store";

  let { record: exportRecord }: DataTableCellBaseProps<ExportRecord> = $props();

  let projectId = page.params.projectId as string;
  let progressInterval = writable<number | undefined>(undefined); // Note: Need to use writable because it's not reactive
  let status = $state(exportRecord.status);
  let exports = $state(exportRecord.exports);

  const processingStatuses = ["running", "pending"];

  $effect(() => {
    periodicCheckJobStatus();

    return () => stopPeriodicCheckJobStatus();
  });

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
          console.log(jobRes);
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
</script>

<div>
  {#key status}
    {#if processingStatuses.includes(status)}
      <Spinner />
    {:else}
      {#each exports as xport (xport.id)}
        <Link href={export_download_path(xport.id)}>
          {xport.filename}
        </Link>
      {/each}
    {/if}
  {/key}
</div>
