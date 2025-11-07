<script lang="ts">
  import EntryPriority from "@/components/app/datasets/entries/badges/entry-priority.svelte";
  import EntryStatus from "@/components/app/datasets/entries/badges/entry-status.svelte";
  import LoadingEntryCard from "@/components/app/datasets/entries/cards/loading-entry-card.svelte";
  import EntryDropdownMenu from "@/components/app/datasets/entries/dropdown-menus/entry-dropdown-menu.svelte";
  import ProjectMemberAvatar from "@/components/app/projects/members/avatars/project-member-avatar.svelte";
  import DataDisplay from "@/components/app/texts/data-display.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import { AspectRatio } from "@/components/ui/aspect-ratio";
  import { Card, CardContent } from "@/components/ui/card";
  import Checkbox from "@/components/ui/checkbox/checkbox.svelte";
  import Link from "@/components/ui/text/Link.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { EntryRecord } from "@/data/model/dataset/entries/record";
  import { mediaBackendDataSource } from "@/data/model/media/medias/medias-record";

  // Props
  interface Props {
    entry: EntryRecord;
    selectedRows: string[];
    onRowSelect: (selectedId: string) => void;
  }
  let { entry, selectedRows, onRowSelect }: Props = $props();

  // State for thumbnail
  let imgContainer: HTMLDivElement | undefined = $state(undefined);
  let containerWidth: number = $state(240);
  let thumbnailImg: HTMLImageElement = $state(new Image());
  let thumbnailUrl: string | null = $state(null);
  let thumbnailError = $state(false);
  let currentImagePosition = $state(0);
  let animationInterval: number | null = $state(null);

  const TOTAL_POSITIONS = 10; // 10 images inside the larger image
  const ANIMATION_INTERVAL_MS = 350; // 1 second per position

  // Functions
  async function fetchData(): Promise<void> {
    await Promise.all([fetchThumbnail()]);
  }

  async function fetchThumbnail(): Promise<void> {
    try {
      thumbnailUrl = await mediaBackendDataSource.getFiles({
        resource: entry.resource,
        key: "thumbnail.jpg",
      });

      thumbnailImg.onload = () => {
        const width = thumbnailImg.width;
        containerWidth = width / TOTAL_POSITIONS;
      };

      thumbnailImg.src = thumbnailUrl;
      thumbnailError = false;
    } catch (error) {
      console.error("Error fetching thumbnail:", error);
      thumbnailError = true;
      thumbnailUrl = null;
    }
  }

  // Animation functions
  function startAnimation() {
    if (animationInterval) return;

    animationInterval = setInterval(() => {
      currentImagePosition = (currentImagePosition + 1) % TOTAL_POSITIONS;
    }, ANIMATION_INTERVAL_MS);
  }

  function stopAnimation() {
    if (animationInterval) {
      clearInterval(animationInterval);
      animationInterval = null;
    }

    currentImagePosition = 0; // Reset to first image
  }

  // Clean up blob URL and animation when component is destroyed
  function cleanup() {
    stopAnimation();

    if (thumbnailUrl) {
      URL.revokeObjectURL(thumbnailUrl);
    }
  }

  $effect(() => {
    return cleanup;
  });
</script>

{#await fetchData()}
  <LoadingEntryCard></LoadingEntryCard>
{:then _}
  <Card class="hover:bg-primary/5 hover:shadow-primary/10 group transition-shadow hover:shadow-md">
    <CardContent class="flex flex-row gap-4">
      <!-- CHECKBOX -->
      <div class="my-auto">
        <Checkbox checked={selectedRows.includes(entry.id)} onCheckedChange={() => onRowSelect(entry.id)}></Checkbox>
      </div>

      <!-- THUMBNAIL -->
      <div class="h-full overflow-hidden" style:width="{containerWidth}px" style:max-width="{containerWidth}px">
        <AspectRatio ratio={16 / 9} class="bg-muted h-full rounded-lg">
          {#if thumbnailUrl}
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
        <Link
          href="/entries/{entry.id}/plugin"
          class="group-hover:text-primary group-hover:cursor-pointer group-hover:underline group-hover:underline-offset-4"
          showIcon
        >
          <Text size="sm" weight="medium">
            {entry.resource}
          </Text>
        </Link>

        <div class="flex flex-col items-start">
          <DataDisplay label="Created at">
            {#snippet slotValue()}
              <DateText datetime={entry.created_at} datetimeFormat="MMM dd, yyyy" size="sm" weight="light" showTooltip
              ></DateText>
            {/snippet}
          </DataDisplay>

          <DataDisplay label="Updated at">
            {#snippet slotValue()}
              <DateText datetime={entry.updated_at} datetimeFormat="MMM dd, yyyy" size="sm" weight="light" showTooltip
              ></DateText>
            {/snippet}
          </DataDisplay>
        </div>

        <!-- PRIORITY AT -->
        <div>
          <EntryPriority {entry} updatable></EntryPriority>
        </div>
      </div>

      <!-- STAGE & ASSIGNED TO -->
      <div class="my-auto flex flex-1 flex-col gap-2">
        <DataDisplay label="Stage" value={entry.wf_step}></DataDisplay>
        <DataDisplay label="Assigned to">
          {#snippet slotValue()}
            <ProjectMemberAvatar memberId={entry.assigned_to_id}></ProjectMemberAvatar>
          {/snippet}
        </DataDisplay>
      </div>

      <!-- STATUS & ACTIONS -->
      <div>
        <div class="flex items-center gap-2">
          <EntryStatus {entry}></EntryStatus>
          <EntryDropdownMenu {entry}></EntryDropdownMenu>
        </div>
      </div>
    </CardContent>
  </Card>
{/await}
