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

  // Persistent order map: keeps positions stable when categories are added/deleted
  let orderMap: Record<string, number> = {};

  // Functions
  function constructCategoryTree(values: IConfigValue[]) {
    type TreeNode = ICategoryTreeNode;

    const root: TreeNode[] = [];
    const nodeMap: Record<string, TreeNode> = {};

    // Collect all paths in the current values set
    const currentPaths: Record<string, boolean> = {};

    values.forEach((value) => {
      const parts = value.id.split("/");

      let currentChildren = root;
      let currentPath = "";

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        currentPaths[currentPath] = true;

        const parent = currentPath.includes("/") ? currentPath.split("/").slice(0, -1).join("/") : null;

        let existingNode = nodeMap[currentPath];

        if (!existingNode) {
          const isLeaf = index === parts.length - 1;

          // Assign order: reuse from orderMap, or assign next available for new paths
          if (!(currentPath in orderMap)) {
            // Compute next order relative to parent group
            const siblings = findSiblingOrders(currentPath, parent);
            const nextOrder = siblings.length > 0 ? Math.max(...siblings) + 1 : 0;
            orderMap[currentPath] = nextOrder;
          }

          existingNode = {
            id: currentPath,
            label: isLeaf ? value.label : humanize(part),
            color: isLeaf ? value.color : null,
            text_color: isLeaf ? value.text_color : null,
            expanded: true,
            parent,
            children: [],
            order: orderMap[currentPath]!,
          };

          nodeMap[currentPath] = existingNode;
          currentChildren.push(existingNode);
        }

        // Actual category node
        if (index === parts.length - 1) {
          existingNode.label = value.label;
          existingNode.color = value.color;
          existingNode.text_color = value.text_color;
        }

        currentChildren = existingNode.children;
      });
    });

    // Clean up stale entries from orderMap (paths no longer in values)
    for (const key of Object.keys(orderMap)) {
      if (!currentPaths[key]) {
        delete orderMap[key];
      }
    }

    function sortTree(nodes: TreeNode[]) {
      nodes.sort((a, b) => a.order - b.order);
      nodes.forEach((node) => sortTree(node.children));
    }

    sortTree(root);
    return root;
  }

  // Find sibling orders for a given path, helping assign new siblings at the end
  function findSiblingOrders(path: string, parent: string | null): number[] {
    const orders: number[] = [];
    const prefix = parent ? parent + "/" : "";

    for (const [key, order] of Object.entries(orderMap)) {
      if (key === path) continue;

      const isSibling = parent ? key.startsWith(prefix) && !key.slice(prefix.length).includes("/") : !key.includes("/");

      if (isSibling) {
        orders.push(order);
      }
    }

    return orders;
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

  function addNewCategory(): void {
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
