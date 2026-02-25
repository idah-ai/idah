<script lang="ts">
  import { page } from "$app/state";
  import { onDestroy } from "svelte";
  import { writable } from "svelte/store";

  import Progress from "@/components/ui/progress/progress.svelte";
  import type { ExportRecord } from "@/data/model/sync/exports/record";
  import { SyncJobRecord, SyncJobsBackendDataSource } from "@/data/model/sync/jobs/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  let { record: exportRecord }: DataTableCellBaseProps<ExportRecord> = $props();

  // Variables
  let projectId = page.params.projectId as string;

  let progressInterval = writable<number | undefined>(undefined); // Note: Need to use writable because it's not reactive
  let jobProgress: number = $state(exportRecord.progress);
  let status = $state(exportRecord.status);

  const processingStatuses = ["running", "pending"];

  $effect(() => {
    periodicCheckJobStatus();

    return () => stopPeriodicCheckJobStatus();
  });

  /**
   * Fetch jobs data every 10 seconds, to keep the status updated
   * Note: Only fetch if the entry is in a processing state
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
            fields: {
              [SyncJobRecord.type]: ["progress", "status"],
            },
            noCache: true,
          });
          jobProgress = jobRes.data.progress;
          status = jobRes.data.status;

          /** If progress = 100%, update entry status to 'ready' */
          if (jobProgress === 1) {
            stopPeriodicCheckJobStatus();
            return;
          }
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
  <div class="flex items-center gap-2">
    {#if jobProgress < 1 && processingStatuses.includes(status)}
      <div class="flex flex-col gap-1">
        <div class="text-muted-foreground flex items-center justify-between gap-4 text-xs font-medium">
          <span> Processing export... </span>
          <span>{Math.round(jobProgress * 100)}%</span>
        </div>

        <Progress value={jobProgress * 100} />
      </div>
    {:else}
      <div class="text-muted-foreground flex items-center justify-between gap-4 text-xs font-medium">
        <span>{status}</span>
      </div>
    {/if}
  </div>
</div>
