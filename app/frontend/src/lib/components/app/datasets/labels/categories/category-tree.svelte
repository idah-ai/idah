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

    // Seed the persistent order map from array positions ONLY for leaf
    // entries that don't already have a position.  This preserves existing
    // positions across deletions (deleting "language/english/e" won't
    // shift "language/english/n" from its original spot).
    values.forEach((value, index) => {
      if (!(value.id in categoryOrderMap)) {
        categoryOrderMap[value.id] = index;
      }
    });

    const usedIndices: Record<number, boolean> = {};
    for (const v of Object.values(categoryOrderMap)) {
      usedIndices[v] = true;
    }
    function nextAvailableIndex(): number {
      let i = 0;
      while (usedIndices[i]) i++;
      usedIndices[i] = true;
      return i;
    }

    // Collect all leaf ids currently present
    const currentLeafIds: Record<string, boolean> = {};
    for (const v of values) {
      currentLeafIds[v.id] = true;
    }

    values.forEach((value) => {
      const parts = value.id.split("/");

      let currentChildren = root;
      let currentPath = "";

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        const parent = currentPath.includes("/") ? currentPath.split("/").slice(0, -1).join("/") : null;

        let existingNode = nodeMap[currentPath];

        if (!existingNode) {
          const isLeaf = index === parts.length - 1;

          // Leaf: use persisted order or assign new one at end.
          // Intermediate: set to 0 initially, will be corrected by
          // assignParentOrders to match first child.
          let order: number;
          if (isLeaf) {
            order = categoryOrderMap[currentPath] ?? nextAvailableIndex();
            categoryOrderMap[currentPath] = order;
          } else {
            order = 0;
          }

          existingNode = {
            id: currentPath,
            label: isLeaf ? value.label : humanize(part),
            color: isLeaf ? value.color : null,
            text_color: isLeaf ? value.text_color : null,
            expanded: true,
            parent,
            children: [],
            order,
          };

          nodeMap[currentPath] = existingNode;
          currentChildren.push(existingNode);
        }

        // Actual category node — update label/color from leaf
        if (index === parts.length - 1) {
          existingNode.label = value.label;
          existingNode.color = value.color;
          existingNode.text_color = value.text_color;
        }

        currentChildren = existingNode.children;
      });
    });

    // Intermediate parent nodes: use the persisted order from the
    // orderMap to keep their position stable across child deletions
    // (e.g. "language" stays at order 1 even after "language/english/e"
    // is deleted).  On first creation, store the order based on the
    // first child so the position is established.
    function assignParentOrders(nodes: TreeNode[]) {
      for (const node of nodes) {
        if (node.children.length > 0) {
          assignParentOrders(node.children);
          if (node.id in categoryOrderMap) {
            node.order = categoryOrderMap[node.id];
          } else {
            node.order = node.children[0].order;
            categoryOrderMap[node.id] = node.order;
          }
        }
      }
    }
    assignParentOrders(root);

    // Sort siblings at every level by order
    function sortTree(nodes: TreeNode[]) {
      nodes.sort((a, b) => a.order - b.order);
      nodes.forEach((node) => sortTree(node.children));
    }

    sortTree(root);

    // Update the global orderMap for intermediate nodes so downstream
    // consumers (sortValuesByTreeOrder, changeSelectableCategory) see
    // consistent values.
    function syncIntermediateOrders(nodes: TreeNode[]) {
      for (const node of nodes) {
        categoryOrderMap[node.id] = node.order;
        if (node.children.length > 0) syncIntermediateOrders(node.children);
      }
    }
    syncIntermediateOrders(root);

    // Prune orderMap entries whose leaves are no longer in the current
    // values set (e.g. "language/english/e" was deleted) AND whose path
    // is not an ancestor of any current leaf.
    const currentPaths: Record<string, boolean> = {};
    for (const node of Object.values(nodeMap)) {
      currentPaths[node.id] = true;
    }
    for (const key of Object.keys(categoryOrderMap)) {
      if (!currentPaths[key] && !currentLeafIds[key]) {
        // Only delete if no current leaf has this as an ancestor path
        const prefix = key + "/";
        const isAncestorOfCurrent = Object.keys(currentLeafIds).some((id) => id.startsWith(prefix));
        if (!isAncestorOfCurrent) {
          delete categoryOrderMap[key];
        }
      }
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
