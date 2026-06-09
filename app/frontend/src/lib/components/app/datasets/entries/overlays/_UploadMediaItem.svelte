<script lang="ts">
  import { ChevronDownIcon, ChevronRightIcon } from "@lucide/svelte";

  import Badge from "@/components/ui/badge/badge.svelte";
  import * as Collapsible from "@/components/ui/collapsible";
  import * as Item from "@/components/ui/item";
  import Spinner from "@/components/ui/spinner/spinner.svelte";

  import UploadItemCollapsibleSection from "./_UploadItemCollapsibleSection.svelte";
  import UploadItemStatusIcon from "./_UploadItemStatusIcon.svelte";

  import { cn } from "@/utils";
  import { humanize } from "@/utils/string";
  import { getStatusLabel } from "./_upload-item-utils";

  import type { UploadItem } from "@/components/app/datasets/entries/overlays/upload-item.types";

  // Props
  interface Props {
    uploadItem: UploadItem;
    maxRetries?: number;
  }
  let { uploadItem, maxRetries = 3 }: Props = $props();

  // Variables
  const { name, uploadedMedias, skippedMedias, errorMedias, isZip, status, errorMessage } = $derived(uploadItem);

  const totalUploadMedias = $derived(uploadedMedias.length);
  const totalSkippedMedias = $derived(skippedMedias.length);
  const totalErrorMedias = $derived(errorMedias.length);
  const hasSkippedMedias = $derived(totalSkippedMedias > 0);
  const hasErrorMedias = $derived(totalErrorMedias > 0);
  const hasIssues = $derived(hasSkippedMedias || hasErrorMedias || !!errorMessage);

  const statusLabel = $derived(getStatusLabel(uploadItem, maxRetries));

  const collapsibleLabel = $derived.by<string>(() => {
    const parts: string[] = [];
    if (hasSkippedMedias) parts.push(`${totalSkippedMedias} skipped`);
    if (hasErrorMedias) parts.push(`${totalErrorMedias} failed`);
    return parts.join(", ");
  });

  let openCollapsible = $state(false);
</script>

<Item.Root variant="outline" class="rounded-xl">
  <Item.Content>
    <div class="flex w-full items-start gap-4">
      <div class="flex flex-col gap-0">
        <Item.Title>{name}</Item.Title>
        <Item.Description>{statusLabel}</Item.Description>
      </div>

      {#if status === "uploading"}
        <div class="ml-auto flex items-center gap-2">
          <Badge variant="default" rounded="full" class="text-xs">
            <Spinner size="sm" class="text-primary-foreground" />
            {humanize(`${status}...`)}
          </Badge>
        </div>
      {:else if status === "retrying"}
        <div class="ml-auto flex items-center gap-2">
          <Badge variant="warning" rounded="full" class="text-xs">
            <Spinner size="sm" class="text-secondary-foreground dark:text-secondary" />
            {humanize(`${status}...`)}
          </Badge>
        </div>
      {:else if status === "completed"}
        <div class="ml-auto flex items-center gap-2">
          <UploadItemStatusIcon
            {isZip}
            totalUploaded={totalUploadMedias}
            totalSkipped={totalSkippedMedias}
            totalErrors={totalErrorMedias}
            {status}
          />
        </div>
      {/if}
    </div>

    <!-- Only show collapsible when upload item is zip -->
    {#if status === "completed" && isZip && hasIssues}
      <Collapsible.Root bind:open={openCollapsible}>
        <Collapsible.Trigger
          class={cn(
            "mt-2 flex w-full cursor-pointer items-center rounded-sm bg-red-100 p-2 focus:outline-none dark:bg-red-900/50",
            {
              "rounded-br-none rounded-bl-none": openCollapsible,
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
        </Collapsible.Trigger>

        <Collapsible.Content class="flex flex-col gap-2 rounded-br-sm rounded-bl-sm bg-red-100 p-2 dark:bg-red-900/50">
          {#if hasSkippedMedias}
            <UploadItemCollapsibleSection label="Skipped" items={skippedMedias} variant="skipped" />
          {/if}

          {#if hasErrorMedias}
            <UploadItemCollapsibleSection label="Failed" items={errorMedias} variant="error" />
          {/if}
        </Collapsible.Content>
      </Collapsible.Root>
    {/if}
  </Item.Content>
</Item.Root>
