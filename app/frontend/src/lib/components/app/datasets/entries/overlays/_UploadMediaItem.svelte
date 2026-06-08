<script lang="ts">
  import { ChevronDownIcon, ChevronRightIcon } from "@lucide/svelte";

  import Badge from "@/components/ui/badge/badge.svelte";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
  import { Item, ItemContent } from "@/components/ui/item";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { cn } from "@/utils";
  import { humanize } from "@/utils/string";
  import { pluralizeUnit } from "@/utils/unit";

  import type { UploadItem } from "@/components/app/datasets/entries/overlays/upload-item.types";

  // Props
  interface Props {
    uploadItem: UploadItem;
    maxRetries?: number;
  }
  let { uploadItem, maxRetries = 3 }: Props = $props();

  // Variables
  const { name, uploadedMedias, skippedMedias, status, errorMessage, retryCount } = $derived(uploadItem);

  const totalUploadMedias = $derived(uploadedMedias.length);
  const totalSkippedMedias = $derived(skippedMedias.length);
  const totalMedias = $derived(totalUploadMedias + totalSkippedMedias);
  const hasSkippedMedias = $derived(totalSkippedMedias > 0);

  const statusLabel = $derived.by<string>(() => {
    switch (status) {
      case "uploading":
        return `${totalUploadMedias} of ${totalMedias} ${pluralizeUnit(totalMedias, "file")} uploaded`;
      case "retrying":
        return `Retrying... (Attempt ${retryCount} of ${maxRetries})`;
      case "completed":
        if (errorMessage) {
          const parts = [`${totalUploadMedias} ${pluralizeUnit(totalUploadMedias, "file")} processed`];
          if (hasSkippedMedias) parts.push(`${totalSkippedMedias} skipped`);
          parts.push(uploadItem.errorMessage ?? "Upload failed");
          return parts.join(", ");
        }
        if (hasSkippedMedias) {
          return `${totalUploadMedias} ${pluralizeUnit(totalUploadMedias, "file")} processed, ${totalSkippedMedias} ${pluralizeUnit(totalSkippedMedias, "file")} skipped`;
        }
        return `${totalUploadMedias} ${pluralizeUnit(totalUploadMedias, "file")} processed`;
      default:
        return "";
    }
  });

  const collapsibleLabel = $derived.by<string>(() => {
    const parts: string[] = [];
    if (hasSkippedMedias) parts.push(`${totalSkippedMedias} skipped`);
    if (errorMessage) parts.push("upload failed");
    return parts.join(", ");
  });

  let openCollapsible = $state(false);
</script>

<Item variant="outline" class="rounded-xl">
  <ItemContent>
    <div class="flex w-full items-start gap-4">
      <div class="flex flex-col gap-0">
        <Text size="sm" weight="semibold">{name}</Text>
        <Text size="sm" weight="normal" class="text-muted-foreground">
          {statusLabel}
        </Text>
      </div>

      {#if status === "uploading"}
        <div class="ml-auto flex items-center gap-2">
          <Spinner size="sm" />
          <Badge variant="default" rounded="full" class="text-xs">{humanize(status)}</Badge>
        </div>
      {:else if status === "retrying"}
        <div class="ml-auto flex items-center gap-2">
          <Spinner size="sm" />
          <Badge variant="warning" rounded="full" class="text-xs">{humanize(status)}</Badge>
        </div>
      {:else if status === "completed"}
        <div class="ml-auto">
          <Badge variant="default" rounded="full" class="text-xs">Processed</Badge>
        </div>
      {/if}
    </div>

    {#if status === "completed" && (hasSkippedMedias || errorMessage)}
      <Collapsible bind:open={openCollapsible}>
        <CollapsibleTrigger
          class={cn(
            "mt-2 flex w-full cursor-pointer items-center rounded-sm bg-red-100 p-2 focus:outline-none dark:bg-red-900/50",
            {
              "rounded-br-none rounded-bl-none bg-red-100 dark:bg-red-900/50": openCollapsible,
            },
          )}
        >
          {collapsibleLabel}

          <div class="ml-auto">
            {#if openCollapsible}
              <ChevronDownIcon class="size-4" />
            {:else}
              <ChevronRightIcon class="size-4" />
            {/if}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent class="flex flex-col gap-2 rounded-br-sm rounded-bl-sm bg-red-100 p-2 dark:bg-red-900/50">
          {#if errorMessage}
            <div class="rounded-sm bg-red-200 p-2 dark:bg-red-800/50">
              <Text size="xs" class="text-destructive">{errorMessage}</Text>
            </div>
          {/if}

          {#each skippedMedias as skippedMedia, skippedMediaIndex (skippedMediaIndex)}
            <div class="rounded-sm bg-amber-100 p-2 dark:bg-amber-900/50">
              <Text size="xs">{skippedMedia.filename}</Text>
              <Text size="xs" class="text-amber-700 dark:text-amber-300">{skippedMedia.message}</Text>
            </div>
          {/each}
        </CollapsibleContent>
      </Collapsible>
    {/if}
  </ItemContent>
</Item>
