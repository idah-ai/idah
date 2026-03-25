<script lang="ts">
  import { DownloadIcon } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import { writable } from "svelte/store";

  import Button from "@/components/ui/button/button.svelte";
  import Progress from "@/components/ui/progress/progress.svelte";

  import { ExportRecord, ExportsBackendDataSource, exportsBasePath } from "@/data/model/sync/exports/record";
  import { SyncJobRecord, SyncJobsBackendDataSource } from "@/data/model/sync/jobs/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: exportRecord }: DataTableCellBaseProps<ExportRecord> = $props();

  // Variables
  const processingStatuses = ["running", "pending"];

  let progressInterval = writable<number | undefined>(undefined); // Note: Need to use writable because it's not reactive
  let status = $derived((exportRecord.job as unknown as SyncJobRecord).status);
  let jobProgress: number = $state(1);

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
          let jobId = exportRecord.job_id;
          let jobRecord: SyncJobRecord | null = null;

          /**
           * If job_id is null (should happen when the export was created and job is not yet assigned),
           * fetch the export again to get the job_id
           */
          if (!jobId) {
            const exportRes = await ExportsBackendDataSource.get(exportRecord.id, {
              included: ["job"],
              fields: {
                [ExportRecord.type]: ["id", "job_id"],
              },
              noCache: true,
            });
            exportRecord = exportRes.data;
            jobId = exportRecord.job_id;
            jobRecord = exportRes.data.job as unknown as SyncJobRecord;
          }
          if (!jobId) return;
          if (!jobRecord) return;

          /** If job is ready, stop the interval */
          if (!processingStatuses.includes(status)) {
            stopPeriodicCheckJobStatus();
            return;
          }

          const jobRes = await SyncJobsBackendDataSource.get(jobId, {
            included: ["exports"],
            fields: {
              [SyncJobRecord.type]: ["progress", "status"],
            },
            noCache: true,
          });

          status = jobRes.data.status;
          jobProgress = jobRes.data.progress;

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

  function openFileLink(exportId: string) {
    window.open(`${exportsBasePath}/${exportId}/download`, "_blank");
  }
</script>

<div class="flex w-full justify-end pr-2">
  {#if jobProgress < 1}
    <div class="flex flex-col gap-1">
      <div class="text-muted-foreground flex items-center justify-between gap-4 text-xs font-medium">
        <span> Processing export... </span>
        <span>{Math.round(jobProgress * 100)}%</span>
      </div>

      <Progress value={jobProgress * 100} />
    </div>
  {:else}
    <Button variant="ghost" size="icon-sm" onclick={() => openFileLink(exportRecord.id)}>
      <DownloadIcon />
    </Button>
  {/if}
</div>
