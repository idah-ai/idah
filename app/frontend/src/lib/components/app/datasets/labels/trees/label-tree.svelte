<script lang="ts">
  import { getContext } from "svelte";

  import Button from "@/components/ui/button/button.svelte";
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
    {/each}
  </div>

  <div>
    <Button variant="outline" onclick={() => onAddCategory()}>
      <PlusIcon class="size-4"></PlusIcon>
      New Category
    </Button>
  </div>
</div>
