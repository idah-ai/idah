<script lang="ts">
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import * as Item from "@/components/ui/item";
  import Text from "@/components/ui/text/Text.svelte";

  import { cn } from "@/utils";
  import { truncateFilename } from "@/utils/string";

  import type { SkippedFile } from "@/data/model/media/medias/medias-record";

  interface Props {
    label: string;
    items: Array<SkippedFile>;
    variant: "skipped" | "error";
  }
  let { label, items, variant }: Props = $props();

  const sectionBgClass = $derived(
    variant === "skipped" ? "bg-amber-100 dark:bg-amber-900/50" : "bg-red-100 dark:bg-red-900/50",
  );

  const itemDescriptionColor = $derived(
    variant === "skipped" ? "text-amber-700 dark:text-amber-300" : "text-destructive",
  );
</script>

<section class={cn("flex flex-col rounded-sm", sectionBgClass)}>
  <div class="p-2">
    <Text size="xs" weight="semibold">{label}</Text>
  </div>

  {#each items as item, idx (idx)}
    {@const { text: displayName, truncated } = truncateFilename(item.filename)}
    <Item.Root class="p-2">
      <Item.Content>
        {#if truncated}
          <Tooltips>
            {#snippet trigger()}
              <Item.Title class="text-xs">{displayName}</Item.Title>
            {/snippet}

            {#snippet content()}
              {item.filename}
            {/snippet}
          </Tooltips>
        {:else}
          <Item.Title class="text-xs">{displayName}</Item.Title>
        {/if}

        <Item.Description class={cn("text-xs", itemDescriptionColor)}>{item.message}</Item.Description>
      </Item.Content>
    </Item.Root>
  {/each}
</section>
