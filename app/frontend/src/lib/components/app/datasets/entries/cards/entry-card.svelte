<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { ExternalLinkIcon } from "@lucide/svelte";
  import { getContext, onDestroy, onMount } from "svelte";

  import EntryPriority from "@/components/app/datasets/entries/badges/entry-priority.svelte";
  import EntryStatus from "@/components/app/datasets/entries/badges/entry-status.svelte";
  import EntryDropdownMenu from "@/components/app/datasets/entries/dropdown-menus/entry-dropdown-menu.svelte";
  import ProjectMemberAvatar from "@/components/app/projects/members/avatars/project-member-avatar.svelte";
  import DataDisplay from "@/components/app/texts/data-display.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import { AspectRatio } from "@/components/ui/aspect-ratio";
  import Button from "@/components/ui/button/button.svelte";
  import { Card, CardContent } from "@/components/ui/card";
  import Checkbox from "@/components/ui/checkbox/checkbox.svelte";
  import Progress from "@/components/ui/progress/progress.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { JobRecord, jobsBackendDataSource } from "@/data/model/media/jobs/record";
  import { mediaBackendDataSource } from "@/data/model/media/medias/medias-record";
  import { authStatus } from "@/security/AuthContext";
  import { humanize } from "@/utils/string";

  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import type { ProjectMemberScope } from "@/security/types";

  // Props
  interface Props {
    entry: EntryRecord;
    selectedEntryIds: string[];
    onRowSelect: (selectedId: string) => void;
    onEntryUpdated: () => void;
  }
  let { entry, selectedEntryIds, onRowSelect, onEntryUpdated }: Props = $props();

  const dataset: DatasetRecord = getContext("dataset");

  // Variables
  const currentAccount = $authStatus.authContext;

  let projectId = page.params.projectId as string;
  let { id: entryId, wf_step, status, assigned_to_id, submitted_by_id, reviewed_by_id } = $derived(entry);
  let canUpdateEntry = $state(false);
  let canDeleteEntry = $state(false);
  let canOpenEntry = $derived.by(() => {
    if (!currentAccount?.id) return false;

    /** Block entry open while media is still being processed */
    if (status === "processing") return false;

    /** If entry is not assigned to anyone, it can open by anyone */
    if (assigned_to_id === null) return true;

    /**
     * If wf_step is "done", allow admin, org_owner, and project_owner to open it
     * Note: Only admin, org_owner, and project_owner can update entry
     */
    if (wf_step === "done" && canUpdateEntry) return true;

    /** If entry is assigned to someone, it can open by the assigned user */
    return assigned_to_id == Number(currentAccount.id);
  });

  const as_project_owner: { as_user: ProjectMemberScope } = {
    as_user: {
      projectId,
      projectMemberRoles: ["project_owner"],
    },
  };

  // Lifecycle
  onMount(async () => {
    canUpdateEntry =
      (await currentAccount?.can("update", "dataset:entries", ["as_org_owner", as_project_owner])) || false;
    canDeleteEntry =
      (await currentAccount?.can("delete", "dataset:entries", ["as_org_owner", as_project_owner])) || false;
    periodicCheckJobStatus();
  });

  // State for thumbnail
  let imgContainer: HTMLDivElement | undefined = $state(undefined);
  let containerWidth: number = $state(240);
  let thumbnailImg: HTMLImageElement = $state(new Image());
  let thumbnailUrl: string | null = $state(null);
  let thumbnailError = $state(false);
  let currentImagePosition = $state(0);
  let animationInterval: ReturnType<typeof setInterval> | null = $state(null);
  let progressIntervalId: ReturnType<typeof setInterval> | null = $state(null);
  let jobProgress: number = $state(entry.wf_step === "start" ? 0 : 1);

  const TOTAL_POSITIONS = 10; // 10 images inside the larger image
  const ANIMATION_INTERVAL_MS = 350;

  // Functions
  async function selectEntry(): Promise<void> {
    if (!currentAccount?.id) return;

    try {
      /**
       * If the entry is unassigned, assign it to the current user
       */
      if (assigned_to_id === null) {
        await entriesBackendDataSource.select({
          id: entryId,
        });
      }
    } catch (error) {
      console.error(error);
      showToast.error({
        title: "Failed to assign entry to you",
      });
    } finally {
      goto(resolve(`/entries/${entryId}/plugin`));
    }
  }

  async function loadThumbnail(): Promise<void> {
    try {
      // Revoke the previous blob URL to avoid memory leaks
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }

      const { resource } = entry;
      let key: string;
      switch (dataset.modality) {
        case "idah-video":
          key = "thumbnail.jpg"; // TODO: recheck if we should also change idah-video's thumbnail to webp as well
          break;
        case "idah-image":
          key = "thumbnail.webp";
          break;
        default:
          key = "processed.webp"; // default fallback image for thumbnail
      }

      thumbnailUrl = await mediaBackendDataSource.getFiles({
        resource,
        key,
      });

      thumbnailImg.onload = () => {
        const width = thumbnailImg.width;

        // For idah-image, use a fixed width. For idah-video, divide by TOTAL_POSITIONS
        if (dataset.modality === "idah-image") {
          containerWidth = 240; // Fixed size for idah-image
        } else {
          containerWidth = width / TOTAL_POSITIONS;
        }
      };

      thumbnailImg.onerror = () => {
        thumbnailError = true;
        thumbnailUrl = null;
      };

      thumbnailImg.src = thumbnailUrl;
      thumbnailError = false;
    } catch (error) {
      console.error("Error fetching thumbnail:", error);
      thumbnailError = true;
      thumbnailUrl = null;
    }
  }

  /**
   * Fetch jobs data every 10 seconds, to keep the status updated
   * Note: Only fetch if the entry is in a processing state
   */
  async function periodicCheckJobStatus() {
    if (entry.wf_step === "start") {
      progressIntervalId = setInterval(async () => {
        try {
          let jobId = entry.job_id;

          if (!jobId) {
            const entryRes = await entriesBackendDataSource.get(entryId, {
              included: ["dataset", "assigned_to", "reviewed_by"],
              noCache: true,
            });
            entry = entryRes.data;
            jobId = entryRes.data.job_id;
          }
          if (!jobId) return;

          if (entry.wf_step !== "start" || entry.status === "errored") {
            stopPeriodicCheckJobStatus();
            jobProgress = 1;
            return;
          }

          const jobRes = await jobsBackendDataSource.get(jobId, {
            fields: {
              [JobRecord.type]: ["progress", "status"],
            },
            noCache: true,
          });
          jobProgress = jobRes.data.progress;

          if (jobProgress === 1) {
            const entryRes = await entriesBackendDataSource.get(entryId, {
              included: ["dataset", "assigned_to", "reviewed_by"],
              noCache: true,
            });
            entry = entryRes.data;
            if (entry.wf_step !== "start") {
              await loadThumbnail();
              stopPeriodicCheckJobStatus();
            }
            return;
          }
        } catch (error) {
          console.error("Error fetching updated entry:", error);
          stopPeriodicCheckJobStatus();
        }
      }, 2_000) as unknown as number;
    } else {
      await loadThumbnail();
    }
  }

  // Animation functions
  function startAnimation(): void {
    if (animationInterval || dataset.modality !== "idah-video") return;

    animationInterval = setInterval(() => {
      currentImagePosition = (currentImagePosition + 1) % TOTAL_POSITIONS;
    }, ANIMATION_INTERVAL_MS) as unknown as number;
  }

  function stopAnimation(): void {
    if (animationInterval) {
      clearInterval(animationInterval);
      animationInterval = null;
    }

    currentImagePosition = 0; // Reset to first image
  }

  // Clean up blob URL and animation when component is destroyed
  function stopPeriodicCheckJobStatus(): void {
    if (progressIntervalId !== null) {
      clearInterval(progressIntervalId);
      progressIntervalId = null;
    }
  }

  // Clean up timers, animation state, and blob URL when component is destroyed
  function cleanup(): void {
    stopAnimation();
    stopPeriodicCheckJobStatus();

    thumbnailImg.onload = null;
    thumbnailImg.onerror = null;

    if (thumbnailUrl) {
      URL.revokeObjectURL(thumbnailUrl);
    }
  }

  onDestroy(cleanup);

  function updateEntry(thisEntry: EntryRecord): void {
    entry = thisEntry;
    onEntryUpdated();
  }
</script>

<Card class="hover:bg-primary/5 hover:shadow-primary/10 group transition-shadow hover:shadow-md">
  <CardContent class="flex">
    <!-- SECTION::LEFT -->
    <section class="flex flex-1 flex-row gap-4">
      <!-- CHECKBOX -->
      {#if canUpdateEntry || canDeleteEntry}
        <div class="my-auto">
          <Checkbox checked={selectedEntryIds.includes(entryId)} onCheckedChange={() => onRowSelect(entryId)} />
        </div>
      {/if}

      <!-- THUMBNAIL -->
      <div class="h-full overflow-hidden" style:width="{containerWidth}px" style:max-width="{containerWidth}px">
        <AspectRatio ratio={16 / 9} class="bg-muted h-full rounded-lg">
          {#if thumbnailUrl}
            {#if dataset.modality === "idah-image"}
              <!-- Display static image for idah-image -->
              <div bind:this={imgContainer} role="img" class="relative h-full w-full overflow-hidden rounded-lg">
                <img src={thumbnailUrl} alt="Entry thumbnail" class="h-full w-full rounded-lg object-cover" />
              </div>
            {:else}
              <!-- Display animated sprite sheet for idah-video -->
              <div
                bind:this={imgContainer}
                role="img"
                class="relative h-full w-full overflow-hidden rounded-lg"
                onmouseenter={startAnimation}
                onmouseleave={stopAnimation}
              >
                <img
                  src={thumbnailUrl}
                  alt="Entry thumbnail"
                  class="absolute top-0 left-0 cursor-pointer object-cover"
                  style:height="{imgContainer?.clientHeight}px"
                  style:width="{containerWidth * TOTAL_POSITIONS}px"
                  style:max-width="none"
                  style:transform="translateX(-{currentImagePosition * containerWidth || 0}px)"
                />
              </div>
            {/if}
          {:else if thumbnailError}
            <div class="text-muted-foreground flex h-full items-center justify-center text-sm">
              Unable to load thumbnail
            </div>
          {:else}
            <div class="flex h-full items-center justify-center">
              <div class="bg-muted/50 h-full w-full animate-pulse rounded-lg"></div>
            </div>
          {/if}
        </AspectRatio>
      </div>

      <!-- INFO -->
      <div class="flex flex-1 flex-col gap-6">
        <!-- RESOURCE -->
        {#if canOpenEntry}
          <Button
            variant="link"
            class="group-hover:text-primary justify-start px-0 group-hover:cursor-pointer group-hover:underline group-hover:underline-offset-4"
            onclick={selectEntry}
          >
            <span class="-ml-3">{entry.name || entry.id}</span>

            <ExternalLinkIcon class="opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </Button>
        {:else}
          <Text size="sm" weight="medium" class="text-muted-foreground">
            {entry.name || entry.id}
          </Text>
        {/if}

        <!-- INFO -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <!-- CREATED AT -->
            <DataDisplay label="Created at">
              {#snippet slotValue()}
                <DateText
                  datetime={entry.created_at}
                  datetimeFormat="MMM dd, yyyy"
                  size="sm"
                  weight="light"
                  showTooltip
                />
              {/snippet}
            </DataDisplay>

            <!-- UPDATED AT -->
            <DataDisplay label="Updated at">
              {#snippet slotValue()}
                <DateText
                  datetime={entry.updated_at}
                  datetimeFormat="MMM dd, yyyy"
                  size="sm"
                  weight="light"
                  showTooltip
                />
              {/snippet}
            </DataDisplay>

            <!-- PRIORITY AT -->
            <div>
              <EntryPriority {entry} updatable />
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <!-- STAGE & ASSIGNED TO -->
            <DataDisplay label="Stage" value={humanize(wf_step)} />

            <!-- NOTE: Only show assigned to if wf_step is not "done" -->
            {#if wf_step !== "done"}
              <DataDisplay label="Assigned to">
                {#snippet slotValue()}
                  <ProjectMemberAvatar member={entry.assigned_to} />
                {/snippet}
              </DataDisplay>
            {/if}

            {#if submitted_by_id}
              <DataDisplay label="Submitted by">
                {#snippet slotValue()}
                  <ProjectMemberAvatar member={entry.submitted_by} />
                {/snippet}
              </DataDisplay>
            {/if}

            {#if reviewed_by_id}
              <DataDisplay label="Reviewed by">
                {#snippet slotValue()}
                  <ProjectMemberAvatar member={entry.reviewed_by} />
                {/snippet}
              </DataDisplay>
            {/if}
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION::RIGHT -->
    <section class="flex flex-row gap-4">
      <!-- STATUS & ACTIONS -->
      <div>
        <div class="flex items-center gap-2">
          {#if jobProgress < 1}
            <div class="flex flex-col gap-1">
              <div class="text-muted-foreground flex items-center justify-between gap-4 text-xs font-medium">
                <span> Processing media... </span>
                <span>{Math.round(jobProgress * 100)}%</span>
              </div>

              <Progress value={jobProgress * 100} />
            </div>
          {:else}
            <EntryStatus {entry} />
          {/if}

          <EntryDropdownMenu {entry} onUnAssigned={updateEntry} onAssigned={updateEntry} />
        </div>
      </div>
    </section>
  </CardContent>
</Card>
