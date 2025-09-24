<script lang="ts">
  import { getContext } from "svelte";

  import { Button } from "@/components/ui/button";
  import { Card, CardContent } from "@/components/ui/card";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import TaggingCard from "@/components/app/datasets/labels/cards/tagging-card.svelte";

  import { PlusIcon, TagIcon } from "@lucide/svelte";

  import type { LabelingConfiguration, TagField } from "@/data/model/dataset/labels";

  // Props
  interface Props {
    onSetTag: (tag: TagField) => void;
    onRemoveTag: (tagId: string) => void;
  }
  let { onSetTag, onRemoveTag }: Props = $props();

  // Contexts
  let labelConfig = getContext("labelConfig") as LabelingConfiguration;

  // Functions
  function addNewTag() {
    onSetTag({
      id: crypto.randomUUID(),
      label: `New Tag`,
      type: "text",
      description: "",
      required: false,
      format: {
        minimum: 0,
        maximum: 0,
        options: [],
        step: 1,
      },
    });
  }
</script>

{#snippet AddNewTagButton()}
  <Button variant="outline" onclick={addNewTag}>
    <PlusIcon class="size-4"></PlusIcon>
    New Tag
  </Button>
{/snippet}

<div class="flex flex-col gap-4">
  {#each labelConfig.taggings as tag, index (index)}
    <TaggingCard {tag} {onSetTag} {onRemoveTag}></TaggingCard>
  {:else}
    <Card>
      <CardContent>
        <ResponseBlock icon={TagIcon} title="No Tagging Yet" description="Create tagging to get started">
          {#snippet actions()}
            {@render AddNewTagButton()}
          {/snippet}
        </ResponseBlock>
      </CardContent>
    </Card>
  {/each}

  {#if labelConfig.properties.length > 0}
    {@render AddNewTagButton()}
  {/if}
</div>
