<script lang="ts">
  import { PlusIcon, WorkflowIcon } from "@lucide/svelte";

  import ResponseBlock from "@/components/app/blocks/response-block.svelte";
  import {
    CategoryTreeNode,
    type ICategoryTreeNode,
  } from "@/components/app/datasets/labels/categories/category-tree-node.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { categoryOrderMap } from "@/components/app/datasets/labels/categories/utils";
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

          // Assign order.
          // If this is a new leaf and the path previously existed only as an
          // intermediate parent (had children that are now gone), use the minimum
          // of its stale descendants' orders to preserve the original position.
          if (!(currentPath in categoryOrderMap)) {
            const staleDescendantOrders = findStaleDescendantOrders(currentPath, currentPaths);
            if (staleDescendantOrders.length > 0) {
              categoryOrderMap[currentPath] = Math.min(...staleDescendantOrders);
            } else {
              // Compute next order relative to parent group
              const orderMapSiblings = findSiblingOrders(currentPath, parent);
              const currentSiblings = currentChildren.map((n) => n.order);
              const allSiblingOrders = Array.from(new Set([...orderMapSiblings, ...currentSiblings]));
              const nextOrder = allSiblingOrders.length > 0 ? Math.max(...allSiblingOrders) + 1 : 0;
              categoryOrderMap[currentPath] = nextOrder;
            }
          } else if (isLeaf) {
            // Path already in orderMap (e.g. was an intermediate parent now becoming leaf).
            // Update its order to reflect its previous subtree position.
            const staleDescendantOrders = findStaleDescendantOrders(currentPath, currentPaths);
            if (staleDescendantOrders.length > 0) {
              categoryOrderMap[currentPath] = Math.min(...staleDescendantOrders);
            }
          }

          existingNode = {
            id: currentPath,
            label: isLeaf ? value.label : humanize(part),
            color: isLeaf ? value.color : null,
            text_color: isLeaf ? value.text_color : null,
            expanded: true,
            parent,
            children: [],
            order: categoryOrderMap[currentPath]!,
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

    // Clean up stale entries from orderMap (paths no longer in values).
    // Preserve intermediate parent paths of stale descendants so their order
    // can be reused if they later become leaf nodes (e.g. "language/thai/south" +
    // "language/thai/east" deleted → keep "language/thai" order; if user later
    // adds "language/thai" as leaf, it reuses its old position).
    const staleKeys = Object.keys(categoryOrderMap).filter((k) => !currentPaths[k]);
    const preservedParents: Record<string, boolean> = {};
    for (const key of staleKeys) {
      // Walk up parent chain: any ancestor of a stale key should be preserved
      const segments = key.split("/");
      for (let i = 1; i < segments.length; i++) {
        const parent = segments.slice(0, i).join("/");
        if (!currentPaths[parent]) {
          preservedParents[parent] = true;
        }
      }
    }
    for (const key of staleKeys) {
      if (!preservedParents[key]) {
        delete categoryOrderMap[key];
      }
    }

    function sortTree(nodes: TreeNode[]) {
      nodes.sort((a, b) => a.order - b.order);
      nodes.forEach((node) => sortTree(node.children));
    }

    sortTree(root);
    return root;
  }

  // Find orders of stale descendants: entries in orderMap that start with path + "/"
  // but are NOT in the current values. Used to preserve position when a subtree
  // is collapsed into a single leaf (e.g. "language/thai/south" + "language/thai/east"
  // deleted, "language/thai" added → use min of their old orders).
  function findStaleDescendantOrders(path: string, currentPaths: Record<string, boolean>): number[] {
    const orders: number[] = [];
    const prefix = path + "/";

    for (const [key, order] of Object.entries(categoryOrderMap)) {
      if (key.startsWith(prefix) && !currentPaths[key]) {
        orders.push(order);
      }
    }

    return orders;
  }

  // Find sibling orders from the module-level order map for a given path
  function findSiblingOrders(path: string, parent: string | null): number[] {
    const orders: number[] = [];
    const prefix = parent ? parent + "/" : "";

    for (const [key, order] of Object.entries(categoryOrderMap)) {
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
