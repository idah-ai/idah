<script lang="ts">
  import { getContext } from "svelte";

  import { Card, CardContent } from "@/components/ui/card";
  import Button from "@/components/ui/button/button.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import { TreeNode } from "@/components/app/datasets/labels/trees/label-tree-node.svelte";

  import { constructTree } from "@/data/model/dataset/dataset-record";
  import { PlusIcon } from "@lucide/svelte";

  import type { CategoryField, LabelingConfiguration } from "@/data/model/dataset/labels";

  // Props
  interface Props {
    onAddCategory: (nodeId?: string) => void;
    onEditCategory: (category: CategoryField) => void;
    onEditCategoryId: (oldId: string, newId: string) => void;
    onRemoveCategory: (categoryId: string) => void;
  }
  let { onAddCategory, onEditCategory, onEditCategoryId, onRemoveCategory }: Props = $props();

  // Contexts
  let labelConfig = getContext("labelConfig") as LabelingConfiguration;

  // Variables
  let treeItems = $derived(constructTree(labelConfig));
</script>

{#snippet AddNewCategoryButton()}
  <Button onclick={() => onAddCategory()}>
    <PlusIcon class="size-4"></PlusIcon>
    New Category
  </Button>
{/snippet}

<div class="flex w-full flex-col gap-4">
  <div id="trees" class="flex w-full flex-col gap-4">
    {#each treeItems as treeNode, index (index)}
      {@render TreeNode({
        labelConfig,
        node: treeNode,
        level: 1,
        onAddCategory,
        onEditCategory,
        onEditCategoryId,
        onRemoveCategory,
      })}
    {:else}
      <Card>
        <CardContent>
          <ResponseBlock icon={PlusIcon} title="No categories Yet" description="Create category to get started">
            {#snippet actions()}
              {@render AddNewCategoryButton()}
            {/snippet}
          </ResponseBlock>
        </CardContent>
      </Card>
    {/each}
  </div>

  {#if treeItems.length > 0}
    <div>
      {@render AddNewCategoryButton()}
    </div>
  {/if}
</div>
