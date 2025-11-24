<script lang="ts" module>
  import { ChevronRightIcon } from "@lucide/svelte";

  import CategoryDropdownMenusActions from "@/components/app/datasets/labels/dropdown-menus/category-dropdown-menus-actions.svelte";
  import CategoryPopover from "@/components/app/datasets/labels/popovers/category-popover.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { cn } from "@/utils";

  import type { IConfigValue } from "@/plugin/interface/Activity";

  // Interfaces and Types
  interface ICategoryTreeNode extends IConfigValue {
    parent: string | null;
    children: Array<ICategoryTreeNode>;
    expanded: boolean;
  }

  // Props
  interface CategoryTreeNodeProps {
    values: IConfigValue[];
    treeItem: ICategoryTreeNode;
    level: number;
    onToggleExpand: (id: string) => void;
    onAddCategory: (nodeId?: string) => void;
    onEditCategoryId: (oldId: string, newId: string) => void;
    onEditCategory: (editedCategory: IConfigValue) => void;
    onRemoveCategory: (categoryId: string) => void;
    onChangeSelectableCategory: (editedCategory: IConfigValue, selectable: boolean) => void;
  }

  export { CategoryTreeNode, type ICategoryTreeNode };
</script>

{#snippet CategoryTreeNode(props: CategoryTreeNodeProps)}
  {@const {
    values,
    treeItem,
    onToggleExpand,
    onAddCategory,
    onEditCategoryId,
    onEditCategory,
    onRemoveCategory,
    onChangeSelectableCategory,
  } = props}
  {@const { id, children } = treeItem}
  {@const level = props.level}
  {@const hasChildren = children.length > 0}

  <div class="group flex w-full items-center" style:margin-left="{(level - 1) * 2}rem">
    <Button
      variant="ghost"
      size="icon-sm"
      class={cn("", hasChildren ? "opacity-100" : "opacity-0")}
      onclick={() => onToggleExpand(id)}
    >
      <ChevronRightIcon
        class={cn("transition-transform duration-200", {
          "rotate-90": props.treeItem.expanded,
        })}
      />
    </Button>

    <CategoryPopover {values} {treeItem} {onEditCategoryId} {onEditCategory} {onChangeSelectableCategory} />

    <CategoryDropdownMenusActions
      {treeItem}
      class="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      onAddSubCategory={() => onAddCategory(id)}
      onDeleteCategory={() => onRemoveCategory(id)}
    />
  </div>

  {#if props.treeItem.expanded}
    {#if hasChildren}
      {#each children as child (child.id)}
        {@const level = child.id.split("/").length}
        {@render CategoryTreeNode({
          values,
          treeItem: child,
          level,
          onToggleExpand,
          onAddCategory,
          onEditCategoryId,
          onEditCategory,
          onRemoveCategory,
          onChangeSelectableCategory,
        })}
      {/each}
    {/if}
  {/if}
{/snippet}
