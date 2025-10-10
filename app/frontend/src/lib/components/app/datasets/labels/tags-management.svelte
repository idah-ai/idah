<script lang="ts">
  import { PlusIcon, TagIcon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import TaggingCard from "@/components/app/datasets/labels/cards/tagging-card.svelte";
  import { Button } from "@/components/ui/button";
  import { Card, CardContent } from "@/components/ui/card";

  import { slugify } from "@/utils/string";

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
    const taggingExists = labelConfig.taggings && labelConfig.taggings.length > 0;
    const newTagLabel: string = `Tag ${taggingExists ? labelConfig.taggings.length + 1 : 1}`;

    onSetTag({
      id: slugify(newTagLabel),
      label: newTagLabel,
      type: "text",
      description: "",
      required: false,
      format: {
        minimum: 0,
        maximum: 0,
        options: [],
        step: 1,
        info: null,
      },
    });
  }
</script>

{#snippet AddNewTagButton()}
  <Button onclick={addNewTag}>
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
