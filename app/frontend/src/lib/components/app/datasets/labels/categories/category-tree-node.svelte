<script lang="ts" module>
  import { ChevronRightIcon } from "@lucide/svelte";

  import CategoryDropdownMenusActions from "@/components/app/datasets/labels/dropdown-menus/category-dropdown-menus-actions.svelte";
  import CategoryPopover from "@/components/app/datasets/labels/popovers/category-popover.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { cn } from "@/utils";

  import type { LabelConfigurationValue } from "@/data/model/dataset/labels";

  // Interfaces and Types
  interface ICategoryTreeNode extends LabelConfigurationValue {
    children: Array<ICategoryTreeNode>;
    expanded: boolean;
  }

  // Props
  interface CategoryTreeNodeProps {
    treeItem: ICategoryTreeNode;
    level: number;
    onToggleExpand: (id: string) => void;
    onAddCategory: (nodeId?: string) => void;
  }

  export { CategoryTreeNode, type ICategoryTreeNode };
</script>

{#snippet CategoryTreeNode(props: CategoryTreeNodeProps)}
  {@const { treeItem, onToggleExpand, onAddCategory } = props}
  {@const { id, children } = treeItem}
  {@const level = props.level}
  {@const hasChildren = children.length > 0}

  <div class="group flex w-full items-center" style:margin-left="{(level - 1) * 2}rem">
    {#if hasChildren}
      <Button variant="ghost" size="icon-sm" onclick={() => onToggleExpand(id)}>
        <ChevronRightIcon
          class={cn("transition-transform duration-200", {
            "rotate-90": props.treeItem.expanded,
          })}
        />
      </Button>
    {/if}

    <CategoryPopover {treeItem} />

    <CategoryDropdownMenusActions
      {treeItem}
      class="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      onAddSubCategory={() => onAddCategory(id)}
      onDeleteCategory={() => {}}
    />
  </div>

  {#if props.treeItem.expanded}
    {#if hasChildren}
      {#each children as child (child.id)}
        {@const level = child.id.split("/").length}
        {@render CategoryTreeNode({
          treeItem: child,
          level,
          onToggleExpand,
          onAddCategory: () => onAddCategory(child.id),
        })}
      {/each}
    {/if}
  {/if}
{/snippet}
