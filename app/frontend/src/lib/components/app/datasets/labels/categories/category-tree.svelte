<script lang="ts">
  import { PlusIcon, WorkflowIcon } from "@lucide/svelte";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import {
    CategoryTreeNode,
    type ICategoryTreeNode,
  } from "@/components/app/datasets/labels/categories/category-tree-node.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { humanize } from "@/utils/string";

  import type { LabelConfigurationValue, LabelingConfiguration } from "@/data/model/dataset/labels";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props {
    values: LabelingConfiguration["values"];
    onAddCategory: (nodeId?: string) => void;
    onEditCategoryId: (oldId: string, newId: string) => void;
    onEditCategory: (editedCategory: LabelConfigurationValue) => void;
    onRemoveCategory: (categoryId: string) => void;
  }
  let { values, onAddCategory, onEditCategoryId, onEditCategory, onRemoveCategory }: Props = $props();

  // Functions
  function constructCategoryTree(values: LabelingConfiguration["values"]) {
    const root: Hash = {};

    for (const category of values) {
      const parts: Array<string> = category.id.split("/");
      let currentNode = root;
      let parentPath: string | null = null;

      /** Walk through each part of the category ID */
      parts.forEach((part, partIndex) => {
        // Build the current path
        const currentPath = parentPath ? `${parentPath}/${part}` : part;

        /** Create node if it doesn't exist */
        currentNode[part] = currentNode[part] || {
          __data: {
            id: currentPath,
            parent: parentPath,
            label: humanize(part),
            color: category.color,
            text_color: category.text_color,
            expanded: true,
          },
          __children: {},
        };

        /** At the last part, store the category info */
        if (partIndex === parts.length - 1) {
          currentNode[part].__data = {
            id: category.id,
            parent: parentPath,
            label: humanize(part),
            color: category.color,
            text_color: category.text_color,
            expanded: true,
          };
        }

        /** Update parent path for next iteration */
        parentPath = currentPath;

        /** Move to the next level in the tree */
        currentNode = currentNode[part].__children;
      });
    }

    /** Convert the nested object structure to an array */
    function convertToArray(node: Hash): ICategoryTreeNode[] {
      return Object.values(node).map((item) => ({
        ...item.__data,
        children: convertToArray(item.__children),
      }));
    }

    return convertToArray(root);
  }

  function toggleExpand(id: string) {
    function toggleNodeExpansion(nodes: Array<ICategoryTreeNode>): Array<ICategoryTreeNode> {
      return nodes.map((node) => {
        if (node.id === id) {
          return { ...node, expanded: !node.expanded };
        } else if (node.children.length > 0) {
          return { ...node, children: toggleNodeExpansion(node.children) };
        }
        return node;
      });
    }

    treeItems = toggleNodeExpansion(treeItems);
  }

  function addNewCategory() {
    onAddCategory(undefined);
  }

  // Variables
  let treeItems = $derived(constructCategoryTree(values));
</script>

<div class="flex w-full flex-col gap-1">
  {#each treeItems as treeItem (treeItem.id)}
    {@render CategoryTreeNode({
      treeItem: treeItem,
      level: 1,
      onToggleExpand: toggleExpand,
      onAddCategory,
      onEditCategoryId,
      onEditCategory,
      onRemoveCategory,
    })}
  {:else}
    <ResponseBlock title="No categories yet" description="Add category to get started" icon={WorkflowIcon}>
      {#snippet actions()}
        <Button size="sm" onclick={addNewCategory}>
          <PlusIcon />
          New Category
        </Button>
      {/snippet}
    </ResponseBlock>
  {/each}
</div>
