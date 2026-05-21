<script lang="ts">
  import { PlusIcon, WorkflowIcon } from "@lucide/svelte";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import {
    CategoryTreeNode,
    type ICategoryTreeNode,
  } from "@/components/app/datasets/labels/categories/category-tree-node.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { humanize } from "@/utils/string";

  import type { IConfigValue } from "@/plugin/v2/types";

  // Props
  interface Props {
    values: IConfigValue[];
    onAddCategory: (nodeId?: string) => void;
    onEditCategoryId: (oldId: string, newId: string) => void;
    onEditCategory: (editedCategory: IConfigValue) => void;
    onRemoveCategory: (categoryId: string) => void;
    onChangeSelectableCategory: (editedCategory: IConfigValue, selectable: boolean) => void;
  }
  let { values, onAddCategory, onEditCategoryId, onEditCategory, onRemoveCategory, onChangeSelectableCategory }: Props =
    $props();

  // Functions
  function constructCategoryTree(values: IConfigValue[]) {
    type TreeNode = ICategoryTreeNode;

    const root: TreeNode[] = [];
    const nodeMap: Record<string, TreeNode> = {};

    for (const value of values) {
      const parts = value.id.split("/");

      let currentChildren = root;
      let currentPath = "";

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        const parent = currentPath.includes("/") ? currentPath.split("/").slice(0, -1).join("/") : null;

        let existingNode = nodeMap[currentPath];

        if (!existingNode) {
          const isLeaf = index === parts.length - 1;

          existingNode = {
            id: currentPath,
            label: isLeaf ? value.label : humanize(part),
            color: isLeaf ? value.color : null,
            text_color: isLeaf ? value.text_color : null,
            expanded: true,
            parent,
            children: [],
          };

          nodeMap[currentPath] = existingNode;
          currentChildren.push(existingNode);
        }

        currentChildren = existingNode.children;
      });
    }

    return root;
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
      values,
      treeItem: treeItem,
      level: 1,
      onToggleExpand: toggleExpand,
      onAddCategory,
      onEditCategoryId,
      onEditCategory,
      onRemoveCategory,
      onChangeSelectableCategory,
    })}
  {:else}
    <ResponseBlock title="No categories yet" description="Add category to get started" icon={WorkflowIcon} size="sm">
      {#snippet actions()}
        <Button size="sm" onclick={addNewCategory}>
          <PlusIcon />
          New Category
        </Button>
      {/snippet}
    </ResponseBlock>
  {/each}
</div>
