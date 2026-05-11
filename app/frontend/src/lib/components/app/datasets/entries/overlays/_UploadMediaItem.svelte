<script lang="ts">
  import { ChevronDownIcon, ChevronRightIcon } from "@lucide/svelte";

  import Badge, { type BadgeVariant } from "@/components/ui/badge/badge.svelte";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
  import { Item, ItemContent } from "@/components/ui/item";
  import { Progress } from "@/components/ui/progress";
  import Text from "@/components/ui/text/Text.svelte";

  import { cn } from "@/utils";
  import { humanize } from "@/utils/string";
  import { pluralizeUnit } from "@/utils/unit";

  import type { UploadItem } from "@/components/app/datasets/entries/overlays/upload-item.types";

  // Props
  interface Props {
    uploadItem: UploadItem;
  }
  let { uploadItem }: Props = $props();

  // Variables
  const { name, uploadedMedias, skippedMedias, status } = $derived(uploadItem);

  const totalUploadMedias = $derived(uploadedMedias.length);
  const totalSkippedMedias = $derived(skippedMedias.length);
  const totalMedias = $derived(totalUploadMedias + totalSkippedMedias);
  const hasMultipleMedias = $derived(totalMedias > 1);
  const hasSkippedMedias = $derived(totalSkippedMedias > 0);

  const progress = $derived((totalUploadMedias / totalMedias) * 100);

  const badgeInfo = $derived.by<{ variant: BadgeVariant }>(() => {
    switch (status) {
      case "success": {
        return { variant: "success" };
      }
      /** Other statuses will be treated as failed */
      default: {
        return { variant: "destructive" };
      }
    }
  });

  let openCollapsible = $state(false);
</script>

<Item variant="outline" class="rounded-xl">
  <ItemContent>
    <div class="flex w-full items-start gap-4">
      <div class="flex flex-col gap-0">
        <Text size="sm" weight="semibold">{name}</Text>
        <Text size="sm" weight="normal" class="text-muted-foreground">
          {#if totalMedias === totalUploadMedias}
            {totalUploadMedias} {pluralizeUnit(totalUploadMedias, "file")} uploaded successfully
          {:else if hasSkippedMedias}
            {totalUploadMedias}
            {pluralizeUnit(totalUploadMedias, "file")} uploaded,
            {totalSkippedMedias}
            {pluralizeUnit(totalSkippedMedias, "file")} skipped
          {:else}
            {totalUploadMedias} {pluralizeUnit(totalUploadMedias, "file")} uploaded
          {/if}
        </Text>
      </div>

      <div class="ml-auto">
        <Badge variant={badgeInfo.variant} rounded="full" class="text-xs">{humanize(status)}</Badge>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <!-- PROGRESS BAR -->
      <Progress value={progress} />
      <!-- PROGRESS COUNT -->
      <Text size="sm" class="text-muted-foreground whitespace-nowrap">
        {#if hasMultipleMedias}
          {totalUploadMedias}/{totalMedias}
        {:else}
          10%
        {/if}
      </Text>
    </div>

    {#if status === "failed"}
      <Collapsible bind:open={openCollapsible}>
        <CollapsibleTrigger
          class={cn(
            "mt-2 flex w-full cursor-pointer items-center rounded-sm bg-red-100 p-2 focus:outline-none dark:bg-red-900/50",
            {
              "rounded-br-none rounded-bl-none bg-red-100 dark:bg-red-900/50": openCollapsible,
            },
          )}
        >
          Failed files

          <div class="ml-auto">
            {#if openCollapsible}
              <ChevronDownIcon class="size-4" />
            {:else}
              <ChevronRightIcon class="size-4" />
            {/if}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent class="flex flex-col gap-1 rounded-br-sm rounded-bl-sm bg-red-100 p-2 dark:bg-red-900/50">
          {#each skippedMedias as skippedMedia, skippedMediaIndex (skippedMediaIndex)}
            <div class="flex flex-col gap-0 px-2">
              <Text size="xs">{skippedMedia.filename}</Text>
              <Text size="xs" class="text-destructive">{skippedMedia.message}</Text>
            </div>
          {/each}
        </CollapsibleContent>
      </Collapsible>
    {/if}
  </ItemContent>
</Item>
